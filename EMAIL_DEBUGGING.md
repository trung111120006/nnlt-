# Email Notification Debugging Guide

## Common Reasons Why Emails Don't Send

### 1. **No Notification Times Match Current Time**
The system only sends emails at the exact times you've configured. 

**Check:**
- Go to Profile → Edit Profile
- Verify you have notification times set
- Make sure they are **enabled** (checkbox checked)
- The time must match **exactly** (hour and minute)

**Test:** Set a notification time for the current hour and minute, then call the check endpoint.

### 2. **Missing SUPABASE_SERVICE_ROLE_KEY**
The system needs this to fetch user emails from Supabase auth.

**Check:**
- Add to `.env.local`:
  ```
  SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
  ```
- Get it from: Supabase Dashboard → Settings → API → Service Role Key
- **Important:** This is different from `NEXT_PUBLIC_SUPABASE_ANON_KEY`

**Test:** Check server logs - you should see warnings if this is missing.

### 3. **Missing Email Service Configuration**
You need to configure an email service (Resend recommended).

**Check:**
- Add to `.env.local`:
  ```
  RESEND_API_KEY=your_resend_api_key
  EMAIL_FROM=noreply@yourdomain.com
  ```
- Sign up at https://resend.com if you haven't
- Verify your API key is correct

**Test:** Without this, emails will only be logged to console, not actually sent.

### 4. **Air Quality is Good (AQI ≤ 100)**
Emails are only sent when AQI > 100 (Unhealthy for Sensitive Groups or worse).

**Check:**
- The system checks air quality before sending
- If AQI is ≤ 100, no emails are sent (by design)
- Check the response from `/api/notifications/check` to see current AQI

**Test:** Manually call `/api/notifications/send` with `aqi_us: 150` to test email sending.

### 5. **Missing Weather/Air Quality API Keys**
The system needs these to check air quality.

**Check:**
- Add to `.env.local`:
  ```
  WEATHER_API_KEY=your_openweather_api_key
  AIR_QUALITY_API_KEY=your_iqair_api_key
  ```

### 6. **No Users Found**
If no users have valid emails, no emails will be sent.

**Check:**
- Verify users exist in Supabase auth
- Verify profiles exist for those users
- Check server logs for warnings about missing emails

## How to Debug

### Step 1: Test the Check Endpoint

Call the endpoint manually and check the response:

```bash
curl http://localhost:3000/api/notifications/check
```

Or in production:
```bash
curl https://yourdomain.com/api/notifications/check
```

**Look for:**
- `notifications_found`: Should be > 0 if you have matching times
- `users_notified`: Should be > 0 if emails were found
- `emails_sent`: Number of emails actually sent
- `air_quality.aqi_us`: Current AQI value
- `debug`: Additional debugging info

### Step 2: Check Server Logs

Look for these log messages:
- `🔔 Checking notifications for X:Y` - Shows current time being checked
- `Found X notification(s) to process` - Shows matching notification times
- `Found X unique user(s) to notify` - Shows users found
- `✅ Found email for user` - Successfully found email
- `⚠️ SUPABASE_SERVICE_ROLE_KEY not configured` - Missing service key
- `🌫️ Air Quality: AQI=X` - Current air quality
- `📨 Preparing to send X email(s)` - About to send emails
- `📧 Email would be sent` - Email logged (if RESEND_API_KEY missing)

### Step 3: Test Email Sending Manually

Test if email sending works by calling the send endpoint directly:

```bash
curl -X POST http://localhost:3000/api/notifications/send \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "your-user-id",
    "user_email": "your-email@example.com",
    "location": "Hanoi, Vietnam",
    "aqi_us": 150,
    "aqi_level": "Unhealthy for Sensitive Groups"
  }'
```

This bypasses the time check and air quality check - it will send an email immediately if configured correctly.

### Step 4: Verify Notification Times

Check your database:

```sql
SELECT user_id, notification_times 
FROM profiles 
WHERE notification_times IS NOT NULL 
AND notification_times != '[]'::jsonb;
```

Verify the format is correct:
```json
[
  {
    "id": "some-id",
    "hour": 9,
    "minute": 0,
    "enabled": true
  }
]
```

## Quick Checklist

- [ ] Notification times are set in Edit Profile
- [ ] Notification times are **enabled** (checkbox checked)
- [ ] Notification time matches current time (for testing)
- [ ] `SUPABASE_SERVICE_ROLE_KEY` is in `.env.local`
- [ ] `RESEND_API_KEY` is in `.env.local`
- [ ] `EMAIL_FROM` is in `.env.local`
- [ ] `WEATHER_API_KEY` is in `.env.local`
- [ ] `AIR_QUALITY_API_KEY` is in `.env.local`
- [ ] User has a profile in the database
- [ ] User email exists in Supabase auth
- [ ] Air quality AQI > 100 (for emails to send)

## Testing with Current Time

To test immediately, set a notification time for the current hour and minute:

1. Check current time (e.g., 14:35)
2. Go to Edit Profile
3. Add notification time: hour=14, minute=35
4. Make sure it's enabled
5. Call `/api/notifications/check` endpoint
6. Check logs and response

## Still Not Working?

1. Check browser console for errors
2. Check server terminal/logs for detailed error messages
3. Verify all environment variables are loaded (restart dev server after adding)
4. Test email sending manually using the `/api/notifications/send` endpoint
5. Verify Supabase connection is working
