import { supabase } from "./supabase";
import { UserProfile, ProfileFormData } from "./types";

export async function getProfile(userId: string): Promise<UserProfile | null> {
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      // Check if it's a "not found" error (PGRST116) or actual error
      if (error.code === "PGRST116") {
        // No profile found, return null (this is normal for new users)
        return null;
      }
      console.error("Error fetching profile:", error);
      return null;
    }

    return data;
  } catch (err: any) {
    // Handle case where table doesn't exist yet
    if (err.message?.includes("relation") || err.message?.includes("does not exist")) {
      console.warn("Profiles table does not exist yet. Please run the SQL setup from SUPABASE_SETUP.md");
      return null;
    }
    console.error("Unexpected error fetching profile:", err);
    return null;
  }
}

export async function createProfile(
  userId: string,
  profileData: ProfileFormData
): Promise<UserProfile | null> {
  try {
    const { data, error } = await supabase
      .from("profiles")
      .insert({
        user_id: userId,
        ...profileData,
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating profile:", error);
      throw error;
    }

    return data;
  } catch (err: any) {
    // Handle case where table doesn't exist yet
    if (err.message?.includes("relation") || err.message?.includes("does not exist")) {
      console.error("Profiles table does not exist. Please run the SQL setup from SUPABASE_SETUP.md");
      throw new Error("Database table not found. Please setup the database first.");
    }
    throw err;
  }
}

export async function updateProfile(
  userId: string,
  profileData: Partial<ProfileFormData & { avatar_url?: string }>
): Promise<UserProfile | null> {
  try {
    const { data, error } = await supabase
      .from("profiles")
      .update({
        ...profileData,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId)
      .select()
      .single();

    if (error) {
      console.error("Error updating profile:", error);
      throw error;
    }

    return data;
  } catch (err: any) {
    // Handle case where table doesn't exist yet
    if (err.message?.includes("relation") || err.message?.includes("does not exist")) {
      console.error("Profiles table does not exist. Please run the SQL setup from SUPABASE_SETUP.md");
      throw new Error("Database table not found. Please setup the database first.");
    }
    throw err;
  }
}

export async function uploadAvatar(
  userId: string,
  file: File
): Promise<string | null> {
  const fileExt = file.name.split(".").pop();
  const fileName = `${userId}-${Date.now()}.${fileExt}`;
  const filePath = `${userId}/${fileName}`;

  // Delete old avatar if exists
  const { data: oldFiles } = await supabase.storage
    .from("avatars")
    .list(userId);
  
  if (oldFiles && oldFiles.length > 0) {
    const oldFileNames = oldFiles.map(f => `${userId}/${f.name}`);
    await supabase.storage.from("avatars").remove(oldFileNames);
  }

  const { error: uploadError } = await supabase.storage
    .from("avatars")
    .upload(filePath, file, {
      cacheControl: "3600",
      upsert: true,
    });

  if (uploadError) {
    console.error("Error uploading avatar:", uploadError);
    return null;
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from("avatars").getPublicUrl(filePath);

  return publicUrl;
}

export async function deleteAvatar(filePath: string): Promise<void> {
  // Extract path from full URL
  const url = new URL(filePath);
  const pathParts = url.pathname.split("/");
  const bucketIndex = pathParts.findIndex(part => part === "avatars");
  if (bucketIndex !== -1 && bucketIndex < pathParts.length - 1) {
    const filePath = pathParts.slice(bucketIndex + 1).join("/");
    await supabase.storage.from("avatars").remove([filePath]);
  }
}

