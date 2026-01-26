# How to Test Email Notifications

## ✅ Fixed Issues

1. **Better JSONB parsing** - Now handles Supabase JSONB format correctly
2. **Enhanced logging** - See exactly what's happening at each step
3. **Test mode** - Test email sending without waiting for exact time match
4. **Better error handling** - More detailed error messages

## 🧪 Testing Methods

### Method 1: Test Mode (Recommended for Quick Testing)

Test email sending without waiting for exact time match:

```powershell
# Test with current time (will send if notification times match)
Invoke-RestMethod -Uri "http://localhost:3000/api/notifications/check?test=true"

# Test with specific time (e.g., 9:30 AM)
Invoke-RestMethod -Uri "http://localhost:3000/api/notifications/check?test=true&hour=9&minute=30"
```

**What test mode does:**
- ✅ Sends emails even if AQI is good (bypasses AQI > 100 check)
- ✅ Uses test AQI value (150) if air quality API fails
- ✅ Shows detailed debug information

### Method 2: Manual Send (Direct Email Test)

Test email sending directly:

```powershell
Invoke-RestMethod -Method Post -Uri "http://localhost:3000/api/notifications/send" `
  -ContentType "application/json" `
  -Body '{"user_email":"your-email@gmail.com","aqi_us":150,"location":"Hanoi, Vietnam"}'
```

### Method 3: Real Time Match (Production Mode)

1. **Set notification time** in Edit Profile to match current time (e.g., if it's 15:30, set hour=15, minute=30)
2. **Make sure it's enabled** (checkbox checked)
3. **Call the check endpoint:**
   ```powershell
   Invoke-RestMethod -Uri "http://localhost:3000/api/notifications/check"
   ```

## 🔍 Debugging

### Check Server Logs

Look for these log messages in your terminal:

```
🔔 Checking notifications for X:Y
📊 Found X profile(s) in database
  📋 Profile [user_id]: Found X notification time(s)
    ⏰ Time: X:Y, Enabled: true, Current: X:Y
    ✅ MATCH! Adding notification for user [user_id]
Found X notification(s) to process
Found X unique user(s) to notify
✅ Found email for user [user_id]: email@example.com
📧 Users to notify: X
🌍 Checking air quality for location: Hanoi, Vietnam
🔑 API Keys configured: WEATHER=true, AIR_QUALITY=true, RESEND=true
🌫️ Air Quality: AQI=X, Level=Y, Is Bad=true, Should Send=true
📨 Preparing to send X email(s)...
```

### Common Issues

1. **"No notifications scheduled for this time"**
   - ✅ Set notification time to match current hour:minute
   - ✅ Make sure it's enabled
   - ✅ Use test mode: `?test=true&hour=X&minute=Y`

2. **"No users found with valid emails"**
   - ✅ Check that `SUPABASE_SERVICE_ROLE_KEY` is in `.env.local`
   - ✅ Restart dev server after adding the key
   - ✅ Verify user exists in Supabase auth

3. **"Air quality is acceptable. No emails sent."**
   - ✅ Use test mode: `?test=true` (bypasses AQI check)
   - ✅ Or wait for AQI > 100

4. **Emails logged but not sent**
   - ✅ Check `RESEND_API_KEY` is correct
   - ✅ Verify `EMAIL_FROM` is set
   - ✅ Check Resend dashboard for errors

## 📋 Quick Checklist

- [ ] `SUPABASE_SERVICE_ROLE_KEY` in `.env.local`
- [ ] `RESEND_API_KEY` in `.env.local`
- [ ] `EMAIL_FROM` in `.env.local`
- [ ] Notification time set in Edit Profile
- [ ] Notification time is **enabled**
- [ ] Restart dev server after changing `.env.local`
- [ ] Check server logs for detailed info

## 🎯 Example: Test Right Now

1. **Set notification time** to current time:
   - Go to Profile → Edit Profile
   - Add notification time: hour = current hour, minute = current minute
   - Make sure enabled checkbox is checked

2. **Test immediately:**
   ```powershell
   Invoke-RestMethod -Uri "http://localhost:3000/api/notifications/check?test=true"
   ```

3. **Check response** - should show:
   ```json
   {
     "message": "Air quality check completed. 1 email(s) sent.",
     "emails_sent": 1,
     "test_mode": true
   }
   ```

4. **Check your email inbox** - you should receive the email!

## 🚀 Production Setup

For production (cron job), the endpoint will:
- ✅ Only send when notification time matches exactly
- ✅ Only send when AQI > 100
- ✅ Use real air quality data

No need for `test=true` parameter in production.
