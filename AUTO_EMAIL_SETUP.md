# Automatic Email Sending Setup

## ✅ Quick Setup (Vercel - Recommended)

If you're deploying to **Vercel**, the `vercel.json` file is already created! Just:

1. **Commit and push** the `vercel.json` file to your repository
2. **Deploy to Vercel** (or push to your main branch if auto-deploy is enabled)
3. **Done!** Vercel will automatically run the check every 5 minutes

The cron job will:
- ✅ Run every 5 minutes (`*/5 * * * *`)
- ✅ Check all notification times
- ✅ Send emails when time matches AND AQI > 100
- ✅ No manual intervention needed

## 📅 Cron Schedule Options

The current schedule is `*/5 * * * *` (every 5 minutes). You can change it in `vercel.json`:

### Option 1: Every 5 minutes (Current - Recommended)
```json
"schedule": "*/5 * * * *"
```
**Best for:** Catching most notification times (9:00, 9:05, 9:10, etc.)

### Option 2: Every 15 minutes
```json
"schedule": "*/15 * * * *"
```
**Best for:** Lower API usage, catches times like 9:00, 9:15, 9:30, 9:45

### Option 3: Every hour at minute 0
```json
"schedule": "0 * * * *"
```
**Best for:** Only notifications set for exact hours (9:00, 10:00, 11:00, etc.)

### Option 4: Every minute (for testing)
```json
"schedule": "* * * * *"
```
**Best for:** Testing only (uses more resources)

## 🚀 Other Deployment Platforms

### Option A: External Cron Service (Any Platform)

Use a free service like [cron-job.org](https://cron-job.org) or [EasyCron](https://www.easycron.com):

1. **Sign up** for a free account
2. **Create a new cron job:**
   - URL: `https://yourdomain.com/api/notifications/check`
   - Schedule: Every 5 minutes (`*/5 * * * *`)
   - Method: GET
3. **Save** and activate

**Recommended Services:**
- [cron-job.org](https://cron-job.org) - Free, reliable
- [EasyCron](https://www.easycron.com) - Free tier available
- [UptimeRobot](https://uptimerobot.com) - Free monitoring + cron

### Option B: Supabase Edge Functions + pg_cron

If you want to run it from Supabase:

1. Create a Supabase Edge Function that calls your API
2. Use `pg_cron` extension to schedule it

### Option C: GitHub Actions (Free)

Create `.github/workflows/email-notifications.yml`:

```yaml
name: Email Notifications

on:
  schedule:
    - cron: '*/5 * * * *'  # Every 5 minutes
  workflow_dispatch:  # Manual trigger

jobs:
  send-notifications:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger notification check
        run: |
          curl -X GET https://yourdomain.com/api/notifications/check
```

## 🔒 Security (Optional)

If you want to secure the endpoint, add authentication:

### Method 1: Query Parameter
Add to your cron URL:
```
https://yourdomain.com/api/notifications/check?secret=YOUR_SECRET_KEY
```

Then update `app/api/notifications/check/route.ts`:
```typescript
const secret = request.nextUrl.searchParams.get('secret');
if (secret !== process.env.CRON_SECRET) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}
```

Add to `.env.local`:
```
CRON_SECRET=your-random-secret-key-here
```

### Method 2: Header Authentication
Some cron services support custom headers. Add:
```
Authorization: Bearer YOUR_SECRET_KEY
```

## ✅ Verification

After setup, verify it's working:

1. **Set a notification time** for 5-10 minutes from now
2. **Wait** for the cron to run
3. **Check your email** - you should receive it!
4. **Check Vercel logs** (if using Vercel):
   - Go to Vercel Dashboard → Your Project → Functions → Cron Jobs
   - See execution logs

## 📊 Monitoring

### Vercel Dashboard
- Go to **Project → Functions → Cron Jobs**
- See execution history and logs
- Check for any errors

### Server Logs
Check your deployment logs for:
```
🔔 Checking notifications for X:Y
📨 Preparing to send X email(s)...
```

## 🐛 Troubleshooting

### Emails not sending automatically

1. **Check cron is running:**
   - Vercel: Check Functions → Cron Jobs in dashboard
   - External: Check cron service dashboard

2. **Check notification times:**
   - Make sure times are set and enabled
   - Times must match cron schedule (if cron runs every 5 min, times like 9:05, 9:10 will work)

3. **Check AQI:**
   - Emails only send when AQI > 100
   - Check air quality API is working

4. **Check logs:**
   - Look for errors in deployment logs
   - Verify all environment variables are set in production

### Cron not running

1. **Vercel:**
   - Make sure `vercel.json` is committed and deployed
   - Check Vercel dashboard → Functions → Cron Jobs
   - Verify the schedule format is correct

2. **External service:**
   - Verify URL is correct
   - Check service status
   - Verify cron job is enabled/active

## 🎯 Best Practices

1. **Notification Times:**
   - Set times that align with cron schedule
   - If cron runs every 5 min, set times like: 9:00, 9:05, 9:10, etc.
   - Avoid times like 9:03, 9:07 (might be missed)

2. **Frequency:**
   - Every 5 minutes is good balance
   - Every minute is overkill (unless testing)
   - Every hour might miss some notification times

3. **Monitoring:**
   - Set up error alerts
   - Monitor email delivery rates
   - Check Resend dashboard for email status

## 📝 Summary

**For Vercel (Easiest):**
1. ✅ `vercel.json` is already created
2. Commit and push to deploy
3. Done!

**For Other Platforms:**
1. Use external cron service (cron-job.org recommended)
2. Set URL to your `/api/notifications/check` endpoint
3. Schedule: Every 5 minutes

Your automatic email notifications are now set up! 🎉
