"use client";

import { useState, useEffect } from "react";
import { X, Upload, User, Briefcase, Calendar, Save, Clock, Plus, Trash2 } from "lucide-react";
import { useAuth } from "./AuthContext";
import { uploadAvatar } from "@/lib/profile";
import { UserProfile, ProfileFormData, NotificationTime } from "@/lib/types";

interface EditProfileProps {
  profile: UserProfile | null;
  onClose: () => void;
  onUpdate: () => void;
}

export function EditProfile({ profile, onClose, onUpdate }: EditProfileProps) {
  const { user } = useAuth();
  const [formData, setFormData] = useState<ProfileFormData>({
    full_name: profile?.full_name || "",
    age: profile?.age || null,
    job: profile?.job || "",
  });
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(
    profile?.avatar_url || null
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notificationTimes, setNotificationTimes] = useState<NotificationTime[]>([]);
  const [loadingNotifications, setLoadingNotifications] = useState(false);

  useEffect(() => {
    if (user) {
      loadNotificationTimes();
    }
  }, [user]);

  const loadNotificationTimes = async () => {
    if (!user) return;
    setLoadingNotifications(true);
    try {
      const response = await fetch(`/api/notifications?user_id=${user.id}`);
      const data = await response.json();
      if (response.ok) {
        setNotificationTimes(data.notification_times || []);
      }
    } catch (err) {
      console.error("Error loading notification times:", err);
    } finally {
      setLoadingNotifications(false);
    }
  };

  const handleAddNotificationTime = async () => {
    if (!user) return;
    const newTime: Partial<NotificationTime> = {
      hour: 9,
      minute: 0,
      enabled: true,
    };

    try {
      const response = await fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: user.id,
          hour: newTime.hour,
          minute: newTime.minute,
          enabled: newTime.enabled,
        }),
      });

      const data = await response.json();
      if (response.ok) {
        await loadNotificationTimes();
      } else {
        setError(data.error || data.details || "Failed to add notification time");
      }
    } catch (err: any) {
      setError(err.message || "Failed to add notification time");
    }
  };

  const handleDeleteNotificationTime = async (id: string) => {
    if (!user) return;
    try {
      const response = await fetch(`/api/notifications?id=${id}&user_id=${user.id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        await loadNotificationTimes();
      } else {
        const data = await response.json();
        setError(data.error || data.details || "Failed to delete notification time");
      }
    } catch (err: any) {
      setError(err.message || "Failed to delete notification time");
    }
  };

  const handleToggleNotificationTime = async (id: string, enabled: boolean) => {
    if (!user) return;
    try {
      const response = await fetch("/api/notifications", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, user_id: user.id, enabled: !enabled }),
      });

      if (response.ok) {
        await loadNotificationTimes();
      } else {
        const data = await response.json();
        setError(data.error || data.details || "Failed to update notification time");
      }
    } catch (err: any) {
      setError(err.message || "Failed to update notification time");
    }
  };

  const handleUpdateNotificationTime = async (id: string, hour: number, minute: number) => {
    if (!user) return;
    try {
      const response = await fetch("/api/notifications", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, user_id: user.id, hour, minute }),
      });

      if (response.ok) {
        await loadNotificationTimes();
      } else {
        const data = await response.json();
        setError(data.error || data.details || "Failed to update notification time");
      }
    } catch (err: any) {
      setError(err.message || "Failed to update notification time");
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setError("File size must be less than 5MB");
        return;
      }
      if (!file.type.startsWith("image/")) {
        setError("File must be an image");
        return;
      }
      setAvatarFile(file);
      setError("");
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);
    setError("");

    try {
      let avatarUrl = profile?.avatar_url || null;
      let uploadAvatarData = null;

      // Upload avatar if new file selected
      if (avatarFile) {
        const uploadedUrl = await uploadAvatar(user.id, avatarFile);
        if (uploadedUrl) {
          avatarUrl = uploadedUrl;
          uploadAvatarData = uploadedUrl; // Also save to upload_avatar column
        }
      }

      // Use API route to update profile
      const updateBody: any = {
        user_id: user.id,
        full_name: formData.full_name || null,
        age: formData.age,
        job: formData.job || null,
        avatar_url: avatarUrl,
      };

      // Only update upload_avatar if a new file was uploaded
      if (uploadAvatarData) {
        updateBody.upload_avatar = uploadAvatarData;
      }

      // Use POST (upsert) to create or update profile
      const response = await fetch('/api/profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateBody),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || data.details || 'Failed to update profile');
      }

      console.log('Profile updated successfully:', data.profile);
      onUpdate();
      onClose();
    } catch (err: any) {
      console.error("Error saving profile:", err);
      if (err.message?.includes("Database table not found") || 
          err.message?.includes("does not exist")) {
        setError("Database not setup. Please run the SQL from SUPABASE_SETUP.md first.");
      } else {
        setError(err.message || "Failed to update profile. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between rounded-t-2xl">
          <h2 className="text-2xl font-bold text-blue-600">Edit Profile</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X size={24} className="text-gray-500" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          {/* Avatar Upload */}
          <div className="flex flex-col items-center">
            <div className="relative">
              <div className="w-32 h-32 rounded-full overflow-hidden bg-gradient-to-br from-blue-500 to-green-500 flex items-center justify-center">
                {avatarPreview ? (
                  <img
                    src={avatarPreview}
                    alt="Avatar preview"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <User className="text-white" size={64} />
                )}
              </div>
              <label
                htmlFor="avatar-upload"
                className="absolute bottom-0 right-0 bg-blue-500 text-white p-2 rounded-full cursor-pointer hover:bg-blue-600 transition-colors shadow-lg"
              >
                <Upload size={20} />
                <input
                  id="avatar-upload"
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>
            </div>
            <p className="text-sm text-gray-700 font-medium mt-2">Click to upload avatar (max 5MB)</p>
          </div>

          {/* Full Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <User size={16} className="inline mr-2" />
              Full Name
            </label>
            <input
              type="text"
              value={formData.full_name}
              onChange={(e) =>
                setFormData({ ...formData, full_name: e.target.value })
              }
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-gray-900 font-medium"
              placeholder="Enter your full name"
            />
          </div>

          {/* Age */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Calendar size={16} className="inline mr-2" />
              Age
            </label>
            <input
              type="number"
              min="1"
              max="120"
              value={formData.age || ""}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  age: e.target.value ? parseInt(e.target.value) : null,
                })
              }
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-gray-900 font-medium"
              placeholder="Enter your age"
            />
          </div>

          {/* Job */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Briefcase size={16} className="inline mr-2" />
              Job / Profession
            </label>
            <input
              type="text"
              value={formData.job}
              onChange={(e) =>
                setFormData({ ...formData, job: e.target.value })
              }
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-gray-900 font-medium"
              placeholder="Enter your job or profession"
            />
          </div>

          {/* Email Notification Times */}
          <div className="pt-4 border-t border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <label className="block text-sm font-medium text-gray-700">
                <Clock size={16} className="inline mr-2" />
                Air Quality Email Notifications
              </label>
              <button
                type="button"
                onClick={handleAddNotificationTime}
                className="flex items-center gap-2 px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm font-medium"
              >
                <Plus size={16} />
                Add Time
              </button>
            </div>
            <p className="text-xs text-gray-600 mb-4">
              Set times to receive email alerts when air quality is bad (AQI &gt; 100)
            </p>

            {loadingNotifications ? (
              <div className="flex items-center justify-center py-4">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
              </div>
            ) : notificationTimes.length === 0 ? (
              <div className="text-center py-6 bg-gray-50 rounded-xl">
                <Clock className="mx-auto mb-2 text-gray-400" size={24} />
                <p className="text-sm text-gray-600 font-medium">No notification times set</p>
                <p className="text-xs text-gray-500 mt-1">Click "Add Time" to set up email alerts</p>
              </div>
            ) : (
              <div className="space-y-3">
                {notificationTimes.map((nt) => (
                  <div
                    key={nt.id}
                    className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-200"
                  >
                    <div className="flex items-center gap-2 flex-1">
                      <input
                        type="number"
                        min="0"
                        max="23"
                        value={nt.hour}
                        onChange={(e) => {
                          const hour = parseInt(e.target.value) || 0;
                          handleUpdateNotificationTime(nt.id, hour, nt.minute);
                        }}
                        className="w-16 px-2 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 font-medium text-sm"
                      />
                      <span className="text-gray-700 font-medium">:</span>
                      <input
                        type="number"
                        min="0"
                        max="59"
                        value={nt.minute}
                        onChange={(e) => {
                          const minute = parseInt(e.target.value) || 0;
                          handleUpdateNotificationTime(nt.id, nt.hour, minute);
                        }}
                        className="w-16 px-2 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 font-medium text-sm"
                      />
                      <span className="text-gray-600 text-sm font-medium ml-2">
                        ({String(nt.hour).padStart(2, "0")}:{String(nt.minute).padStart(2, "0")})
                      </span>
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={nt.enabled}
                        onChange={() => handleToggleNotificationTime(nt.id, nt.enabled)}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700 font-medium">
                        {nt.enabled ? "Enabled" : "Disabled"}
                      </span>
                    </label>
                    <button
                      type="button"
                      onClick={() => handleDeleteNotificationTime(nt.id)}
                      className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      title="Delete"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 border border-gray-300 rounded-xl text-gray-700 hover:bg-gray-50 transition-colors font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-3 bg-gradient-to-r from-blue-500 to-green-500 text-white rounded-xl hover:from-blue-600 hover:to-green-600 transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <Save size={20} />
              {loading ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

