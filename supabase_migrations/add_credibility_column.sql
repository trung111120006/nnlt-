-- Add credibility column to profiles table
-- This column stores the credibility points for each user
-- Default value is 0 for existing users

ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS credibility INTEGER DEFAULT 0 NOT NULL;

-- Add comment to explain the column
COMMENT ON COLUMN public.profiles.credibility IS 'Credibility points earned when user reports match other users reports in adjacent locations';
