export interface UserProfile {
  id: string;
  user_id: string;
  full_name: string | null;
  age: number | null;
  job: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProfileFormData {
  full_name: string;
  age: number | null;
  job: string;
}

