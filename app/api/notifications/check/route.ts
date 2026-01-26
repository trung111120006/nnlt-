import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables');
}

// Use service role key if available for admin operations, otherwise use anon key
const supabase = createClient(
  supabaseUrl,
  supabaseServiceRoleKey || supabaseAnonKey
);

// Helper function to send email (same as in send/route.ts)
async function sendEmail(to: string, subject: string, html: string) {
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

  // Fallback: Log email (for development)
  console.log('📧 Email would be sent:');
  console.log('To:', to);
  console.log('Subject:', subject);
  console.log('HTML:', html);
  return { success: true, message: 'Email logged (no email service configured)' };
}

function getAQILevel(usAqi: number): string {
  if (usAqi <= 50) return 'Good';
  if (usAqi <= 100) return 'Moderate';
  if (usAqi <= 150) return 'Unhealthy for Sensitive Groups';
  if (usAqi <= 200) return 'Unhealthy';
  if (usAqi <= 300) return 'Very Unhealthy';
  return 'Hazardous';
}

// GET or POST - Check air quality and send notifications to users
export async function GET(request: NextRequest) {
  return handleCheckAndNotify(request);
}

export async function POST(request: NextRequest) {
  return handleCheckAndNotify(request);
}

async function handleCheckAndNotify(request?: NextRequest) {
  try {
    // Allow test mode via query parameter
    const searchParams = request?.nextUrl.searchParams;
    const testMode = searchParams?.get('test') === 'true';
    const testHour = searchParams?.get('hour') ? parseInt(searchParams.get('hour')!) : null;
    const testMinute = searchParams?.get('minute') ? parseInt(searchParams.get('minute')!) : null;
    
    const currentHour = testHour !== null ? testHour : new Date().getHours();
    const currentMinute = testMinute !== null ? testMinute : new Date().getMinutes();

    console.log(`🔔 Checking notifications for ${currentHour}:${currentMinute}${testMode ? ' (TEST MODE)' : ''}`);

    // Get all profiles with notification_times that match current time
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('user_id, notification_times');

    if (profilesError) {
      console.error('Error fetching profiles:', profilesError);
      return NextResponse.json(
        { 
          error: 'Failed to fetch profiles',
          details: profilesError.message
        },
        { status: 500 }
      );
    }

    console.log(`📊 Found ${profiles?.length || 0} profile(s) in database`);

    // Filter notification times that match current time
    const notificationTimes: Array<{ user_id: string; hour: number; minute: number; enabled: boolean; id: string }> = [];
    
    if (profiles) {
      for (const profile of profiles) {
        if (!profile.notification_times) {
          console.log(`  ⏭️  Profile ${profile.user_id}: no notification_times`);
          continue;
        }
        
        let times: any[] = [];
        
        // Handle JSONB format - Supabase returns it as an object/array directly
        if (Array.isArray(profile.notification_times)) {
          times = profile.notification_times;
        } else if (typeof profile.notification_times === 'string') {
          try {
            // Try parsing if it's a JSON string
            const parsed = JSON.parse(profile.notification_times);
            times = Array.isArray(parsed) ? parsed : [parsed];
          } catch (e) {
            console.error(`  ❌ Error parsing notification_times JSON for user ${profile.user_id}:`, e);
            continue;
          }
        } else if (typeof profile.notification_times === 'object' && profile.notification_times !== null) {
          // JSONB might come as object, convert to array
          times = Array.isArray(profile.notification_times) ? profile.notification_times : [profile.notification_times];
        }
        
        console.log(`  📋 Profile ${profile.user_id}: Found ${times.length} notification time(s)`);
        
        for (const time of times) {
          if (!time || typeof time !== 'object') {
            console.warn(`  ⚠️  Invalid time entry:`, time);
            continue;
          }
          
          const hour = typeof time.hour === 'number' ? time.hour : parseInt(time.hour);
          const minute = typeof time.minute === 'number' ? time.minute : parseInt(time.minute);
          const enabled = time.enabled !== false; // Default to true if not specified
          
          console.log(`    ⏰ Time: ${hour}:${minute}, Enabled: ${enabled}, Current: ${currentHour}:${currentMinute}`);
          
          if (enabled && hour === currentHour && minute === currentMinute) {
            console.log(`    ✅ MATCH! Adding notification for user ${profile.user_id}`);
            notificationTimes.push({
              user_id: profile.user_id,
              hour,
              minute,
              enabled,
              id: time.id || crypto.randomUUID(),
            });
          }
        }
      }
    }

    if (!notificationTimes || notificationTimes.length === 0) {
      return NextResponse.json(
        { 
          message: 'No notifications scheduled for this time',
          current_time: `${currentHour}:${currentMinute}`,
          debug: {
            profiles_checked: profiles?.length || 0,
            test_mode: testMode
          },
          notifications_sent: 0
        },
        { status: 200 }
      );
    }

    console.log(`Found ${notificationTimes.length} notification(s) to process`);

    // Get unique user IDs
    const userIds = [...new Set(notificationTimes.map(nt => nt.user_id))];
    console.log(`Found ${userIds.length} unique user(s) to notify`);
    
    // Check if service role key is configured
    if (!supabaseServiceRoleKey) {
      console.warn('⚠️ SUPABASE_SERVICE_ROLE_KEY not configured. Cannot fetch user emails.');
    }
    
    // Get user profiles and emails
    const usersToNotify: Array<{ user_id: string; email: string; full_name: string | null; age: number | null }> = [];

    for (const userId of userIds) {
      // Get profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, age')
        .eq('user_id', userId)
        .maybeSingle();

      // Get user email (requires service role key)
      let userEmail: string | null = null;
      if (supabaseServiceRoleKey) {
        try {
          const { data: authUser, error: authError } = await supabase.auth.admin.getUserById(userId);
          if (!authError && authUser?.user?.email) {
            userEmail = authUser.user.email;
            console.log(`✅ Found email for user ${userId}: ${userEmail}`);
          } else {
            console.warn(`❌ Could not get email for user ${userId}:`, authError?.message);
          }
        } catch (err: any) {
          console.error(`❌ Error fetching email for user ${userId}:`, err.message);
        }
      } else {
        console.warn(`⚠️ Skipping user ${userId} - SUPABASE_SERVICE_ROLE_KEY not configured`);
      }

      if (userEmail) {
        usersToNotify.push({
          user_id: userId,
          email: userEmail,
          full_name: profile?.full_name || null,
          age: profile?.age || null,
        });
      }
    }

    console.log(`📧 Users to notify: ${usersToNotify.length}`);

    if (usersToNotify.length === 0) {
      return NextResponse.json(
        { 
          message: 'No users found with valid emails',
          debug: {
            notification_times_found: notificationTimes.length,
            unique_users: userIds.length,
            service_role_key_configured: !!supabaseServiceRoleKey
          },
          notifications_sent: 0
        },
        { status: 200 }
      );
    }

    // Check air quality for each user's location (default to Hanoi)
    const WEATHER_API_KEY = process.env.WEATHER_API_KEY;
    const AIR_QUALITY_API_KEY = process.env.AIR_QUALITY_API_KEY;
    const RESEND_API_KEY = process.env.RESEND_API_KEY;
    const location = 'Hanoi, Vietnam'; // You can customize this per user later

    console.log(`🌍 Checking air quality for location: ${location}`);
    console.log(`🔑 API Keys configured: WEATHER=${!!WEATHER_API_KEY}, AIR_QUALITY=${!!AIR_QUALITY_API_KEY}, RESEND=${!!RESEND_API_KEY}`);

    let airQualityData: { aqi_us: number; level: string } | null = null;

    if (WEATHER_API_KEY && AIR_QUALITY_API_KEY) {
      try {
        // Get weather data to get coordinates
        const weatherUrl = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(location)}&appid=${WEATHER_API_KEY}&units=metric`;
        const weatherResponse = await fetch(weatherUrl);
        
        if (weatherResponse.ok) {
          const weatherData = await weatherResponse.json();
          const { lat, lon } = weatherData.coord || {};

          if (lat && lon) {
            // Get air quality
            const aqUrl = `https://api.airvisual.com/v2/nearest_city?lat=${lat}&lon=${lon}&key=${AIR_QUALITY_API_KEY}`;
            const aqResponse = await fetch(aqUrl);

            if (aqResponse.ok) {
              const aqData = await aqResponse.json();
              if (aqData.status === 'success' && aqData.data?.current?.pollution) {
                const pollution = aqData.data.current.pollution;
                const aqius = pollution.aqius || 50;
                airQualityData = {
                  aqi_us: aqius,
                  level: getAQILevel(aqius),
                };
              }
            }
          }
        }
      } catch (error) {
        console.error('Error fetching air quality:', error);
      }
    }

    // Only send emails if air quality is bad (AQI > 100) OR in test mode
    const isBadAirQuality = airQualityData && airQualityData.aqi_us > 100;
    const shouldSendEmails = testMode || isBadAirQuality; // In test mode, send regardless of AQI
    
    console.log(`🌫️ Air Quality: AQI=${airQualityData?.aqi_us || 'N/A'}, Level=${airQualityData?.level || 'N/A'}, Is Bad=${isBadAirQuality}, Should Send=${shouldSendEmails}`);
    
    if (!airQualityData && !testMode) {
      console.warn('⚠️ Could not fetch air quality data. Check API keys.');
    } else if (!isBadAirQuality && !testMode) {
      console.log(`✅ Air quality is acceptable (AQI: ${airQualityData?.aqi_us || 'N/A'}). No emails will be sent.`);
    }
    
    if (!RESEND_API_KEY) {
      console.warn('⚠️ RESEND_API_KEY not configured. Emails will be logged but not sent.');
    }
    
    let emailsSent = 0;
    const emailResults: Array<{ user_id: string; email: string; success: boolean; error?: string }> = [];

    if (shouldSendEmails) {
      // Use test AQI if in test mode and no air quality data
      const aqiToUse = testMode && !airQualityData ? 150 : (airQualityData?.aqi_us || 50);
      const levelToUse = testMode && !airQualityData ? 'Unhealthy for Sensitive Groups' : (airQualityData?.level || 'Moderate');
      
      if (testMode) {
        console.log(`🧪 TEST MODE: Will send emails with AQI=${aqiToUse}`);
      }
      
      console.log(`📨 Preparing to send ${usersToNotify.length} email(s)...`);
      for (const user of usersToNotify) {
        try {
          const userName = user.full_name || user.email.split('@')[0];
          const healthWarning = user.age && user.age < 18 
            ? 'Children and young adults are particularly vulnerable to poor air quality. Please limit outdoor activities.'
            : user.age && user.age > 65
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
                    <div class="aqi-badge">AQI: ${aqiToUse}</div>
                    <p><strong>Level: ${levelToUse}</strong></p>
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

          await sendEmail(user.email, emailSubject, emailHtml);
          emailsSent++;
          emailResults.push({ user_id: user.user_id, email: user.email, success: true });
        } catch (error: any) {
          console.error(`Error sending email to ${user.email}:`, error);
          emailResults.push({ 
            user_id: user.user_id, 
            email: user.email, 
            success: false, 
            error: error.message 
          });
        }
      }
    }

    return NextResponse.json(
      {
        message: shouldSendEmails 
          ? `Air quality check completed. ${emailsSent} email(s) sent.`
          : 'Air quality is acceptable. No emails sent.',
        current_time: `${currentHour}:${currentMinute}`,
        air_quality: airQualityData,
        notifications_found: notificationTimes.length,
        users_notified: usersToNotify.length,
        emails_sent: emailsSent,
        email_results: emailResults,
        test_mode: testMode,
        debug: {
          should_send: shouldSendEmails,
          is_bad_air_quality: isBadAirQuality,
          resend_configured: !!RESEND_API_KEY
        }
      },
      { status: 200 }
    );

  } catch (error: any) {
    console.error('Error checking and sending notifications:', error);
    return NextResponse.json(
      {
        error: 'Failed to check and send notifications',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      },
      { status: 500 }
    );
  }
}
