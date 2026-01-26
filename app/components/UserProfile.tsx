"use client";

import { useState, useEffect } from "react";
import { User, Mail, MapPin, Calendar, BarChart3, Edit2, Briefcase, Clock, Bell } from "lucide-react";
import { useAuth } from "./AuthContext";
import { getProfile } from "@/lib/profile";
import { UserProfile as UserProfileType, NotificationTime } from "@/lib/types";
import { EditProfile } from "./EditProfile";

interface Report {
  id: string;
  created_at: string;
  number: string;
  location: string;
  problem: string;
  user_id: string;
  time_ago?: string;
}

export function UserProfile() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<UserProfileType | null>(null);
  const [userReports, setUserReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [reportsLoading, setReportsLoading] = useState(true);
  const [showEditModal, setShowEditModal] = useState(false);
  const [dbError, setDbError] = useState<string | null>(null);
  const [notificationTimes, setNotificationTimes] = useState<NotificationTime[]>([]);
  const [loadingNotifications, setLoadingNotifications] = useState(false);

  useEffect(() => {
    if (user) {
      loadProfile();
      loadUserReports();
      loadNotificationTimes();
    }
  }, [user]);

  const loadProfile = async () => {
    if (!user) return;
    setLoading(true);
    setDbError(null);
    try {
      const profileData = await getProfile(user.id);
      setProfile(profileData);
    } catch (error: any) {
      console.error("Failed to load profile:", error);
      // Check if it's a database setup error
      if (error?.message?.includes("Database table not found") || 
          error?.message?.includes("does not exist")) {
        setDbError("Database not setup. Please run the SQL from SUPABASE_SETUP.md");
      }
      // Set profile to null if error (user doesn't have profile yet)
      setProfile(null);
    } finally {
      setLoading(false);
    }
  };

  const loadUserReports = async () => {
    if (!user) return;
    setReportsLoading(true);
    try {
      const response = await fetch("/api/reports");
      if (response.ok) {
        const data = await response.json();
        // Filter reports for current user
        const userReportsList = (data.reports || []).filter(
          (report: Report) => report.user_id === user.id
        );
        setUserReports(userReportsList);
      }
    } catch (error) {
      console.error("Failed to load user reports:", error);
      setUserReports([]);
    } finally {
      setReportsLoading(false);
    }
  };

  const loadNotificationTimes = async () => {
    if (!user) return;
    setLoadingNotifications(true);
    try {
      const response = await fetch(`/api/notifications?user_id=${user.id}`);
      if (response.ok) {
        const data = await response.json();
        setNotificationTimes(data.notification_times || []);
      }
    } catch (error) {
      console.error("Failed to load notification times:", error);
      setNotificationTimes([]);
    } finally {
      setLoadingNotifications(false);
    }
  };

  // Calculate user stats from database
  const userStats = {
    reportsSubmitted: userReports.length,
    contributions: userReports.length, // Using reports as contributions
  };

  // Format recent activity from user reports
  const recentActivity = userReports.slice(0, 5).map((report) => ({
    type: "Report",
    location: report.location,
    number: report.number,
    date: new Date(report.created_at).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }),
    timeAgo: report.time_ago || "Recently",
    problem: report.problem,
  }));

  const displayName = profile?.full_name || user?.email?.split("@")[0] || "User";
  const memberSince = user?.created_at
    ? new Date(user.created_at).toLocaleDateString("en-US", {
        month: "short",
        year: "numeric",
      })
    : "Recently";

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="bg-gradient-to-r from-blue-500 to-green-500 rounded-2xl p-8 text-white shadow-lg">
          <h2 className="text-3xl font-bold mb-2">Profile</h2>
          <p className="text-white opacity-95">Your air quality contribution dashboard</p>
        </div>
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-blue-500 to-green-500 rounded-2xl p-8 text-white shadow-lg">
        <h2 className="text-3xl font-bold mb-2">Profile</h2>
        <p className="text-blue-100">Your air quality contribution dashboard</p>
      </div>

      {dbError && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-yellow-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-medium text-yellow-800 mb-1">Database Setup Required</h3>
              <p className="text-sm text-yellow-700">{dbError}</p>
              <p className="text-xs text-yellow-600 mt-2">
                Check the <code className="bg-yellow-100 px-1 rounded">SUPABASE_SETUP.md</code> file for instructions.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Profile Card */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-2xl p-6 shadow-lg">
            <div className="flex flex-col items-center mb-6">
              <div className="relative">
                <div className="w-24 h-24 rounded-full overflow-hidden bg-gradient-to-br from-blue-500 to-green-500 flex items-center justify-center">
                  {profile?.avatar_url ? (
                    <img
                      src={profile.avatar_url}
                      alt="Avatar"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <User className="text-white" size={48} />
                  )}
                </div>
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-1 mt-4">{displayName}</h3>
              <p className="text-gray-700 font-medium mb-4">
                {profile?.job || "Air Quality Contributor"}
              </p>
            </div>

            <div className="space-y-3 border-t border-gray-200 pt-4">
              <div className="flex items-center gap-3 text-gray-800 font-medium">
                <Mail size={18} />
                <span className="truncate">{user?.email}</span>
              </div>
              {profile?.age && (
                <div className="flex items-center gap-3 text-gray-800 font-medium">
                  <Calendar size={18} />
                  <span>{profile.age} years old</span>
                </div>
              )}
              {profile?.job && (
                <div className="flex items-center gap-3 text-gray-800 font-medium">
                  <Briefcase size={18} />
                  <span>{profile.job}</span>
                </div>
              )}
              <div className="flex items-center gap-3 text-gray-800 font-medium">
                <Calendar size={18} />
                <span>Member since {memberSince}</span>
              </div>
            </div>

            <button
              onClick={() => setShowEditModal(true)}
              className="w-full mt-4 flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-green-500 text-white rounded-xl hover:from-blue-600 hover:to-green-600 transition-all font-medium shadow-md hover:shadow-lg"
            >
              <Edit2 size={18} />
              Edit Profile
            </button>
          </div>
        </div>

        {/* Stats & Activity */}
        <div className="lg:col-span-2 space-y-6">
          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white rounded-xl p-5 shadow-lg text-center">
              <BarChart3 className="text-blue-500 mx-auto mb-2" size={24} />
              <div className="text-2xl font-bold text-gray-900">{userStats.reportsSubmitted}</div>
              <div className="text-sm text-gray-700 font-medium">Reports</div>
            </div>
            <div className="bg-white rounded-xl p-5 shadow-lg text-center">
              <BarChart3 className="text-green-500 mx-auto mb-2" size={24} />
              <div className="text-2xl font-bold text-gray-900">{userStats.contributions}</div>
              <div className="text-sm text-gray-700 font-medium">Contributions</div>
            </div>
          </div>

          {/* Email Notifications */}
          <div className="bg-white rounded-2xl p-6 shadow-lg">
            <div className="flex items-center gap-2 mb-4">
              <Bell className="text-blue-500" size={20} />
              <h3 className="text-xl font-bold text-gray-900">Email Notifications</h3>
            </div>
            {loadingNotifications ? (
              <div className="flex items-center justify-center py-4">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
              </div>
            ) : notificationTimes.length === 0 ? (
              <div className="text-center py-6 bg-gray-50 rounded-xl">
                <Bell className="mx-auto mb-2 text-gray-400" size={24} />
                <p className="text-sm text-gray-600 font-medium">No notification times configured</p>
                <p className="text-xs text-gray-500 mt-1">Set up email alerts in Edit Profile</p>
              </div>
            ) : (
              <div className="space-y-2">
                {notificationTimes
                  .filter(nt => nt.enabled)
                  .sort((a, b) => a.hour - b.hour || a.minute - b.minute)
                  .map((nt) => (
                    <div
                      key={nt.id}
                      className="flex items-center gap-3 p-3 bg-blue-50 rounded-xl border border-blue-200"
                    >
                      <Clock className="text-blue-600" size={18} />
                      <span className="text-gray-800 font-medium">
                        {String(nt.hour).padStart(2, "0")}:{String(nt.minute).padStart(2, "0")}
                      </span>
                      <span className="text-sm text-gray-600">
                        Air quality alerts when AQI &gt; 100
                      </span>
                    </div>
                  ))}
                {notificationTimes.filter(nt => !nt.enabled).length > 0 && (
                  <p className="text-xs text-gray-500 mt-2">
                    {notificationTimes.filter(nt => !nt.enabled).length} disabled notification(s)
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Recent Activity */}
          <div className="bg-white rounded-2xl p-6 shadow-lg">
            <h3 className="text-xl font-bold text-gray-900 mb-4">Recent Activity</h3>
            {reportsLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
                <span className="ml-3 text-gray-600 font-medium">Loading reports...</span>
              </div>
            ) : recentActivity.length === 0 ? (
              <div className="text-center py-8">
                <MapPin className="h-10 w-10 mx-auto mb-3 text-gray-300" />
                <p className="text-gray-600 font-medium">No reports yet.</p>
                <p className="text-sm text-gray-500 mt-1">Start contributing by submitting a report!</p>
              </div>
            ) : (
              <div className="space-y-3">
                {recentActivity.map((activity, index) => (
                  <div
                    key={index}
                    className="flex items-start justify-between p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-start gap-3 flex-1">
                      <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                        <MapPin className="text-blue-600" size={18} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold text-gray-900">{activity.type}</span>
                          <span className="text-gray-400">•</span>
                          <span className="text-blue-600 font-medium">#{activity.number}</span>
                        </div>
                        <div className="text-sm text-gray-700 font-medium mb-1">{activity.location}</div>
                        <div className="text-sm text-gray-600 line-clamp-1">{activity.problem}</div>
                      </div>
                    </div>
                    <div className="text-right ml-4 flex-shrink-0">
                      <div className="text-sm text-gray-700 font-medium mb-1">{activity.date}</div>
                      <div className="flex items-center gap-1 text-xs text-gray-500">
                        <Clock size={12} />
                        <span>{activity.timeAgo}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Edit Profile Modal */}
      {showEditModal && (
        <EditProfile
          profile={profile}
          onClose={() => {
            setShowEditModal(false);
            // Reload profile after closing to ensure avatar updates are reflected
            loadProfile();
          }}
          onUpdate={() => {
            loadProfile();
            loadUserReports(); // Also reload reports in case anything changed
            loadNotificationTimes(); // Reload notification times
          }}
        />
      )}
    </div>
  );
}
