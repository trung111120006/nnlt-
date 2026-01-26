# Email Notification Setup

## 1. Add Notification Times Column to Profiles Table

Run this SQL in Supabase SQL Editor to add the `notification_times` column to the existing `profiles` table:

```sql
-- Add notification_times column to profiles table (stored as JSON array)
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS notification_times JSONB DEFAULT '[]'::jsonb;

-- Optional: Create an index for faster queries on notification_times
CREATE INDEX IF NOT EXISTS idx_profiles_notification_times 
ON public.profiles USING GIN (notification_times);
```

The `notification_times` column will store an array of notification time objects in this format:
```json
[
  {
    "id": "unique-id",
    "hour": 9,
    "minute": 0,
    "enabled": true
  },
  {
    "id": "unique-id-2",
    "hour": 18,
    "minute": 30,
    "enabled": true
  }
]
```

## 2. Email Configuration

For email sending, you have several options:

### Option A: Using Resend (Recommended)
1. Sign up at https://resend.com
2. Get your API key
3. Add to `.env.local`:
   ```
   RESEND_API_KEY=your_resend_api_key
   ```

### Option B: Using Nodemailer with SMTP
1. Configure SMTP settings in `.env.local`:
   ```
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USER=your_email@gmail.com
   SMTP_PASS=your_app_password
   ```

### Option C: Using Supabase Edge Functions
You can create a Supabase Edge Function to send emails using their built-in email service.

## 3. Environment Variables

Add to your `.env.local`:
```
# Email service (choose one)
RESEND_API_KEY=your_key_here
# OR
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_password

# Email sender
EMAIL_FROM=noreply@yourdomain.com
EMAIL_FROM_NAME=Air Quality Alert
```

## 4. Setup Cron Job (Optional)

To automatically check air quality and send emails, you can:

### Option A: Vercel Cron Jobs (Recommended for Vercel deployments)

Create `vercel.json` in your project root:

```json
{
  "crons": [
    {
      "path": "/api/notifications/check",
      "schedule": "0 * * * *"
    }
  ]
}
```

This runs every hour at minute 0 (e.g., 1:00, 2:00, 3:00).

### Option B: External Cron Service (cron-job.org, EasyCron, etc.)

1. Sign up for a cron service
2. Set the URL to: `https://yourdomain.com/api/notifications/check`
3. Set schedule to run every hour (or more frequently if needed)
4. Optionally add authentication header if you want to secure the endpoint

### Option C: Supabase Edge Functions with pg_cron

You can create a Supabase Edge Function and use pg_cron to schedule it.

## 5. Testing the Notification System

### Test Notification Times Management

1. Go to Profile page
2. Click "Edit Profile"
3. Scroll to "Air Quality Email Notifications" section
4. Click "Add Time" to add notification times (defaults to 9:00 AM)
5. Adjust hour and minute using the number inputs
6. Toggle enable/disable checkbox for each time slot
7. Delete time slots using the trash icon
8. Changes are saved automatically - no need to click a separate save button
9. Verify times appear in your profile page under "Email Notifications" section

### Test Email Sending (Manual)

You can manually trigger email sending by calling:

```bash
curl -X POST https://yourdomain.com/api/notifications/send \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "your-user-id",
    "user_email": "your-email@example.com",
    "location": "Hanoi, Vietnam",
    "aqi_us": 150,
    "aqi_level": "Unhealthy for Sensitive Groups"
  }'
```

### Test Scheduled Check

Call the check endpoint manually:

```bash
curl https://yourdomain.com/api/notifications/check
```

This will:
1. Check current time
2. Find all enabled notification times matching current time
3. Check air quality for configured location
4. Send emails if AQI > 100

## 6. Important Notes

- **Service Role Key**: For production, you'll need `SUPABASE_SERVICE_ROLE_KEY` in your `.env.local` to fetch user emails from `auth.users` table. Get this from Supabase Dashboard → Settings → API → Service Role Key.

- **Email Service**: Make sure to configure at least one email service (Resend recommended) before deploying to production.

- **Air Quality Threshold**: Emails are only sent when AQI > 100 (Unhealthy for Sensitive Groups or worse).

- **User Age**: The system uses user age from profiles to provide age-appropriate health recommendations in emails.

- **Location**: Currently defaults to "Hanoi, Vietnam". You can customize this per user by adding a `location` field to profiles table.
