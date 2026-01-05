"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { WeatherDashboard } from "./WeatherDashboard";
import { UserReports } from "./UserReports";
import { UserProfile } from "./UserProfile";
import { ChatBox } from "./ChatBox";
import { Footer } from "./Footer";
import { useAuth } from "./AuthContext";
import { Cloud, Users, User, LogOut } from "lucide-react";

export default function App() {
  const [activeTab, setActiveTab] = useState<
    "weather" | "reports" | "profile"
  >("weather");
  const { user, signOut, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !user && pathname === "/") {
      router.push("/signin");
    }
  }, [user, loading, router, pathname]);

  const handleSignOut = async () => {
    await signOut();
    router.push("/signin");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-green-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="bg-gradient-to-br from-blue-500 to-green-500 p-2 rounded-lg">
                <Cloud className="text-white" size={24} />
              </div>
              <h1 className="text-2xl font-bold text-gray-900">AirWeather</h1>
            </div>
            <div className="flex items-center gap-4">
              <nav className="flex gap-2">
                <button
                  onClick={() => setActiveTab("weather")}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all font-medium ${
                    activeTab === "weather"
                      ? "bg-gradient-to-r from-blue-500 to-green-500 text-white shadow-md"
                      : "text-gray-700 hover:bg-blue-50 hover:text-blue-600"
                  }`}
                >
                  <Cloud size={18} />
                  <span className="hidden sm:inline">Weather & Air</span>
                </button>
                <button
                  onClick={() => setActiveTab("reports")}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all font-medium ${
                    activeTab === "reports"
                      ? "bg-gradient-to-r from-blue-500 to-green-500 text-white shadow-md"
                      : "text-gray-700 hover:bg-blue-50 hover:text-blue-600"
                  }`}
                >
                  <Users size={18} />
                  <span className="hidden sm:inline">Live Reports</span>
                </button>
                <button
                  onClick={() => setActiveTab("profile")}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all font-medium ${
                    activeTab === "profile"
                      ? "bg-gradient-to-r from-blue-500 to-green-500 text-white shadow-md"
                      : "text-gray-700 hover:bg-blue-50 hover:text-blue-600"
                  }`}
                >
                  <User size={18} />
                  <span className="hidden sm:inline">Profile</span>
                </button>
              </nav>
              <button
                onClick={handleSignOut}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors"
                title="Sign out"
              >
                <LogOut size={18} />
                <span className="hidden sm:inline">Sign out</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === "weather" && <WeatherDashboard />}
        {activeTab === "reports" && <UserReports />}
        {activeTab === "profile" && <UserProfile />}
      </main>

      {/* Chat Box - Bottom Right */}
      <ChatBox />

      {/* Footer with Founders */}
      <Footer />
    </div>
  );
}

