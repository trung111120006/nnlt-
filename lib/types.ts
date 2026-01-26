export interface UserProfile {
  id: string;
  user_id: string;
  full_name: string | null;
  age: number | null;
  job: string | null;
  avatar_url: string | null;
  notification_times?: NotificationTime[] | null;
  created_at: string;
  updated_at: string;
}

export interface ProfileFormData {
  full_name: string;
  age: number | null;
  job: string;
}

export interface NotificationTime {
  id: string;
  user_id: string;
  hour: number; // 0-23
  minute: number; // 0-59
  enabled: boolean;
  created_at: string;
}

export interface NotificationTimeFormData {
  hour: number;
  minute: number;
  enabled: boolean;
}

