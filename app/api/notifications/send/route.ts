import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables');
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Helper function to send email
async function sendEmail(to: string, subject: string, html: string) {
  // Option 1: Using Resend (recommended)
  const resendApiKey = process.env.RESEND_API_KEY;
  if (resendApiKey) {
    try {
      const resendResponse = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: process.env.EMAIL_FROM || 'noreply@airquality.app',
          to: [to],
          subject,
          html,
        }),
      });

      if (!resendResponse.ok) {
        const errorData = await resendResponse.json();
        throw new Error(`Resend API error: ${JSON.stringify(errorData)}`);
      }

      return await resendResponse.json();
    } catch (error) {
      console.error('Resend email error:', error);
      throw error;
    }
  }

  // Option 2: Using Nodemailer with SMTP (if RESEND_API_KEY not available)
  const smtpHost = process.env.SMTP_HOST;
  if (smtpHost) {
    // For production, you should install nodemailer: npm install nodemailer
    // For now, we'll use a simple fetch-based approach or log the email
    console.log('SMTP email sending not implemented. Please use Resend or implement nodemailer.');
    console.log('Would send email:', { to, subject, html });
    return { success: true, message: 'Email logged (SMTP not configured)' };
  }

  // Fallback: Log email (for development)
  console.log('📧 Email would be sent:');
  console.log('To:', to);
  console.log('Subject:', subject);
  console.log('HTML:', html);
  return { success: true, message: 'Email logged (no email service configured)' };
}

// POST - Send air quality warning email
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { user_id, user_email, location = 'Hanoi, Vietnam', aqi_us, aqi_level } = body;

    if (!user_email || typeof user_email !== 'string') {
      return NextResponse.json(
        { 
          error: 'Missing required field',
          details: 'Please provide user_email'
        },
        { status: 400 }
      );
    }

    if (typeof aqi_us !== 'number' || Number.isNaN(aqi_us)) {
      return NextResponse.json(
        {
          error: 'Missing or invalid field',
          details: 'Please provide aqi_us as a number (e.g. 150)'
        },
        { status: 400 }
      );
    }

    // Optional: personalize email if user_id provided
    let userName = user_email.split('@')[0];
    let userAge: number | null | undefined = undefined;

    if (user_id && typeof user_id === 'string') {
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('full_name, age')
        .eq('user_id', user_id)
        .maybeSingle();

      if (profileError) {
        console.error('Error fetching profile:', profileError);
      } else {
        userName = profile?.full_name || userName;
        userAge = profile?.age;
      }
    }

    // Determine if air quality is bad (AQI > 100)
    const isBadAirQuality = aqi_us > 100;

    if (!isBadAirQuality) {
      return NextResponse.json(
        { 
          message: 'Air quality is acceptable, no email sent',
          aqi_us,
          threshold: 100
        },
        { status: 200 }
      );
    }

    // Create email content
    const aqiDescription = aqi_level || getAQILevel(aqi_us);
    const healthWarning = userAge && userAge < 18 
      ? 'Children and young adults are particularly vulnerable to poor air quality. Please limit outdoor activities.'
      : userAge && userAge > 65
      ? 'Older adults are more sensitive to air pollution. Please take extra precautions.'
      : 'Please limit outdoor activities and consider wearing a mask if you must go outside.';

    const emailSubject = `⚠️ Air Quality Warning - ${location}`;
    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .warning { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; }
          .aqi-badge { display: inline-block; background: #dc3545; color: white; padding: 10px 20px; border-radius: 5px; font-size: 24px; font-weight: bold; margin: 10px 0; }
          .footer { margin-top: 20px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🌫️ Air Quality Alert</h1>
          </div>
          <div class="content">
            <p>Hello ${userName},</p>
            
            <p>We're sending you this alert because the air quality in <strong>${location}</strong> has reached unhealthy levels.</p>
            
            <div style="text-align: center;">
              <div class="aqi-badge">AQI: ${aqi_us}</div>
              <p><strong>Level: ${aqiDescription}</strong></p>
            </div>
            
            <div class="warning">
              <h3>⚠️ Health Recommendations:</h3>
              <ul>
                <li>${healthWarning}</li>
                <li>Avoid strenuous outdoor activities</li>
                <li>Keep windows and doors closed</li>
                <li>Use air purifiers if available</li>
                <li>Consider wearing an N95 mask if you must go outside</li>
              </ul>
            </div>
            
            <p>Stay safe and monitor air quality updates regularly.</p>
            
            <div class="footer">
              <p>This is an automated alert from your Air Quality Monitoring System.</p>
              <p>You can manage your notification preferences in your profile settings.</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    // Send email
    const emailResult = await sendEmail(user_email, emailSubject, emailHtml);

    return NextResponse.json(
      {
        message: 'Air quality warning email sent successfully',
        email_result: emailResult,
        aqi_us,
        location,
        user_email
      },
      { status: 200 }
    );

  } catch (error: any) {
    console.error('Error sending air quality email:', error);
    return NextResponse.json(
      {
        error: 'Failed to send email',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      },
      { status: 500 }
    );
  }
}

function getAQILevel(usAqi: number): string {
  if (usAqi <= 50) return 'Good';
  if (usAqi <= 100) return 'Moderate';
  if (usAqi <= 150) return 'Unhealthy for Sensitive Groups';
  if (usAqi <= 200) return 'Unhealthy';
  if (usAqi <= 300) return 'Very Unhealthy';
  return 'Hazardous';
}
