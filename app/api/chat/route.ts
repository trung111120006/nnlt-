import { NextResponse } from "next/server";
import { fetchWeatherAndAirQuality } from "../../lib/weatherService";

// Simple in-memory rate limiting
const requestCache = new Map<string, { count: number; resetTime: number }>();

function checkRateLimit(identifier: string): boolean {
  const now = Date.now();
  const limit = requestCache.get(identifier);
  
  if (!limit || now > limit.resetTime) {
    requestCache.set(identifier, { count: 1, resetTime: now + 60000 }); // 60s window
    return true;
  }
  
  if (limit.count >= 20) { 
    return false;
  }
  
  limit.count++;
  return true;
}

// Helper to format weather data for the LLM
function formatWeatherDataForLLM(data: any): string {
  if (!data) return "Could not fetch weather data.";
  
  let summary = `Current weather in ${data.location.name}, ${data.location.country}:
- Temperature: ${data.current?.temp_c}°C (${data.current?.temp_f}°F)
- Condition: ${data.current?.condition?.text}
- Humidity: ${data.current?.humidity}%
- Wind: ${data.current?.wind_kph} km/h`;

  if (data.air_quality?.current) {
    summary += `\n\nAir Quality:
- AQI (US): ${data.air_quality.current.aqi_us}
- Level: ${data.air_quality.current.level}
- Main Pollutant: ${data.air_quality.current.main_pollutant}`;
  }

  return summary;
}

export async function POST(req: Request) {
  try {
    const { prompt, context } = await req.json();
    
    // Validation
    if (!prompt || typeof prompt !== 'string') {
      return NextResponse.json({ error: "Invalid prompt" }, { status: 400 });
    }
    
    // Rate limiting
    const forwardedFor = req.headers.get('x-forwarded-for');
    const clientId = forwardedFor ? forwardedFor.split(',')[0].trim() : "unknown";
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

    const systemHint = `You are a helpful assistant for a city reporting app. 
You can answer questions about the app or about real-time weather and air quality using the available tools.
If the user asks for weather or air quality for a specific city, USE THE get_weather TOOL.
Always respond in the same language as the user.
Current context: ${context?.url ? `User is viewing: ${context.url}` : ''}`;

    const tools = [
      {
        functionDeclarations: [
          {
            name: "get_weather",
            description: "Get current weather and air quality for a specific city.",
            parameters: {
              type: "OBJECT",
              properties: {
                location: {
                  type: "STRING",
                  description: "The city and country, e.g. 'Ho Chi Minh, Vietnam' or 'London'",
                },
              },
              required: ["location"],
            },
          },
        ],
      },
    ];

    const messages = [
      { role: "user", parts: [{ text: `${systemHint}\n\nUser: ${prompt}` }] }
    ];

    // First API call to determine tool usage
    const response1 = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: messages,
          tools: tools,
        }),
      }
    );

    const data1 = await response1.json();
    const candidate1 = data1.candidates?.[0];
    const funcCall = candidate1?.content?.parts?.find((p: any) => p.functionCall);

    if (funcCall) {
      const { name, args } = funcCall.functionCall;
      
      if (name === "get_weather") {
        console.log(`Calling tool get_weather for ${args.location}`);
        
        let toolResult = "";
        try {
            const weatherData = await fetchWeatherAndAirQuality(args.location);
            toolResult = formatWeatherDataForLLM(weatherData);
        } catch (e: any) {
            toolResult = `Error fetching weather: ${e.message}`;
        }

        // Send tool result back to model
        const response2 = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [
                messages[0],
                {
                  role: "model",
                  parts: [{ functionCall: funcCall.functionCall }]
                },
                {
                  role: "function",
                  parts: [{
                    functionResponse: {
                      name: "get_weather",
                      response: {
                        content: toolResult
                      }
                    }
                  }]
                }
              ],
              tools: tools
            }),
          }
        );

        const data2 = await response2.json();
        const candidate2 = data2.candidates?.[0];
        let finalContent = candidate2?.content?.parts?.[0]?.text;

        if (!finalContent) {
          console.warn("Gemini 2nd call failed to summarize. Response:", JSON.stringify(data2));
          // Fallback: Just show the raw data nicely if the model refuses to summarize
          finalContent = `I gathered the data but couldn't write a summary. Here is the info:\n\n${toolResult}`;
        }
        
        return NextResponse.json({ reply: finalContent });
      }
    }

    // No tool call, check for text response
    const part = candidate1?.content?.parts?.[0];
    const text = part?.text;
    
    if (text) {
      return NextResponse.json({ reply: text });
    }

    // Debugging: Log full response if no text and no function call
    console.error("Gemini API Unexpected Response:", JSON.stringify(data1, null, 2));

    return NextResponse.json({ 
      reply: "I received your message but couldn't generate a text response. Please try again." 
    });

  } catch (err: any) {
    console.error("Chat API Error:", err);
    return NextResponse.json({ 
      error: "Service unavailable",
      reply: "I'm having trouble connecting right now."
    }, { status: 500 });
  }
}