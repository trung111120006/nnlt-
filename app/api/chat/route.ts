import { NextResponse } from "next/server";

// Thêm: Rate limiting simple (tránh spam)
const requestCache = new Map<string, { count: number; resetTime: number }>();

// Clean up expired cache entries periodically
function cleanupCache() {
  const now = Date.now();
  for (const [key, value] of requestCache.entries()) {
    if (now > value.resetTime) {
      requestCache.delete(key);
    }
  }
}

// Run cleanup every 5 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(cleanupCache, 5 * 60 * 1000);
}

function checkRateLimit(identifier: string): boolean {
  const now = Date.now();
  const limit = requestCache.get(identifier);
  
  if (!limit || now > limit.resetTime) {
    requestCache.set(identifier, { count: 1, resetTime: now + 60000 }); // 60s window
    return true;
  }
  
  if (limit.count >= 20) { // Max 20 requests per minute
    return false;
  }
  
  limit.count++;
  return true;
}

export async function POST(req: Request) {
  try {
    const { prompt, context } = await req.json();
    
    // Validation cải tiến
    if (!prompt || typeof prompt !== 'string') {
      return NextResponse.json({ error: "Invalid prompt" }, { status: 400 });
    }
    
    if (prompt.trim().length === 0) {
      return NextResponse.json({ error: "Prompt cannot be empty" }, { status: 400 });
    }
    
    if (prompt.length > 10000) {
      return NextResponse.json({ error: "Prompt too long (max 10000 characters)" }, { status: 400 });
    }

    // Rate limiting - extract first IP from x-forwarded-for (can contain multiple IPs)
    const forwardedFor = req.headers.get('x-forwarded-for');
    const clientId = forwardedFor ? forwardedFor.split(',')[0].trim() : (req.headers.get('x-real-ip') || 'unknown');
    if (!checkRateLimit(clientId)) {
      return NextResponse.json({ 
        error: "Too many requests. Please wait a moment." 
      }, { status: 429 });
    }

    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || "";
    if (!apiKey) {
      return NextResponse.json({ 
        error: "API key not configured" 
      }, { status: 500 });
    }

    // System hint cải tiến với nhiều ngữ cảnh hơn
    const systemHint = `You are an intelligent website assistant with the following capabilities:
- Answer questions based on the provided page context
- Provide accurate information about weather, air quality, and forecasts
- Support multiple languages: always respond in the same language as the user
- Be concise but informative
- If you don't know something from the context, say so clearly
- Format responses with proper structure when needed

Current context: ${context?.url ? `Analyzing page: ${context.url}` : 'General assistance'}`;
    
    const pageBlock = context?.pageText 
      ? `\n\n=== PAGE CONTEXT (${context.pageText.length} characters) ===\n${context.pageText.substring(0, 8000)}\n=== END CONTEXT ===` 
      : '';
    const urlLine = context?.url ? `\nSource URL: ${context.url}` : '';
    const fullPrompt = `${systemHint}${urlLine}${pageBlock}\n\nUser: ${prompt.trim()}`;

    console.log(`[API Call] Prompt length: ${fullPrompt.length}, User: ${clientId}`);

    // Retry logic với exponential backoff
    let lastError: any = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              contents: [
                {
                  role: "user",
                  parts: [{ text: fullPrompt }]
                }
              ],
              generationConfig: {
                temperature: 0.7,
                topK: 40,
                topP: 0.95,
                maxOutputTokens: 2048, // Tăng lên cho responses dài hơn
                candidateCount: 1,
              },
              safetySettings: [
                {
                  category: "HARM_CATEGORY_HARASSMENT",
                  threshold: "BLOCK_MEDIUM_AND_ABOVE"
                },
                {
                  category: "HARM_CATEGORY_HATE_SPEECH",
                  threshold: "BLOCK_MEDIUM_AND_ABOVE"
                },
                {
                  category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
                  threshold: "BLOCK_MEDIUM_AND_ABOVE"
                },
                {
                  category: "HARM_CATEGORY_DANGEROUS_CONTENT",
                  threshold: "BLOCK_MEDIUM_AND_ABOVE"
                }
              ]
            })
          }
        );

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`[Attempt ${attempt + 1}] Gemini API error:`, errorText);
          
          if (response.status === 429) {
            // Rate limit from Gemini - wait and retry
            await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 1000));
            continue;
          }
          
          return NextResponse.json({ 
            error: "API request failed",
            details: response.status === 400 ? "Invalid request" : errorText
          }, { status: response.status });
        }

        const data = await response.json();
        
        // Xử lý các trường hợp đặc biệt
        if (!data.candidates || data.candidates.length === 0) {
          return NextResponse.json({ 
            error: "No response generated",
            reply: "I apologize, but I couldn't generate a response. Please try rephrasing your question."
          }, { status: 200 });
        }

        const candidate = data.candidates[0];
        
        // Check finish reason
        if (candidate.finishReason === "SAFETY") {
          return NextResponse.json({ 
            reply: "I apologize, but I cannot provide a response to that query due to content safety guidelines. Please try asking in a different way."
          }, { status: 200 });
        }
        
        if (candidate.finishReason === "RECITATION") {
          return NextResponse.json({ 
            reply: "I cannot provide that specific information. Could you rephrase your question?"
          }, { status: 200 });
        }
        
        const text = candidate.content?.parts?.[0]?.text;
        
        if (!text) {
          return NextResponse.json({ 
            error: "Empty response",
            reply: "I received your question but couldn't generate a proper response. Please try again."
          }, { status: 200 });
        }

        console.log(`[Success] Response length: ${text.length}`);
        
        return NextResponse.json({ 
          reply: text.trim(),
          metadata: {
            model: "gemini-2.5-flash",
            finishReason: candidate.finishReason,
            responseLength: text.length
          }
        });

      } catch (fetchError: any) {
        lastError = fetchError;
        console.error(`[Attempt ${attempt + 1}] Fetch error:`, fetchError.message);
        
        if (attempt < 2) {
          // Exponential backoff: 1s, 2s, 4s
          await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 1000));
        }
      }
    }

    // Nếu tất cả attempts đều fail
    throw lastError || new Error("All retry attempts failed");

  } catch (err: any) {
    console.error("[Fatal Error]", err);
    return NextResponse.json({ 
      error: "Service temporarily unavailable",
      details: process.env.NODE_ENV === 'development' ? err.message : undefined,
      reply: "I'm having trouble connecting right now. Please try again in a moment."
    }, { status: 503 });
  }
}