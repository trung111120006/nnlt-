"use client";

import { useState, useEffect } from "react";
import { MapPin, Calendar, TrendingUp, AlertCircle, Plus, X, RefreshCw, Send, Clock } from "lucide-react";
import { useAuth } from "./AuthContext";

interface Report {
  id: string;
  created_at: string;
  number: string;
  location: string;
  problem: string;
  user_id: string;
  time_ago?: string;
  reported_by?: string;
}

export function UserReports() {
  const { user } = useAuth();
  const isAuthenticated = !!user;
  const [reports, setReports] = useState<Report[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [submitSuccess, setSubmitSuccess] = useState(false);

  // Fast report form state
  const [formData, setFormData] = useState({
    number: "",
    location: "",
    problem: "",
  });

  // Fetch reports from database
  const fetchReports = async () => {
    try {
      setIsLoading(true);
      const response = await fetch("/api/reports");
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error("Error fetching reports:", errorData);
        setReports([]);
        return;
      }

      const data = await response.json();
      // Filter out reports older than 3 hours
      const now = new Date();
      const threeHoursAgo = new Date(now.getTime() - 3 * 60 * 60 * 1000);
      const activeReports = (data.reports || []).filter((report: Report) => {
        const reportDate = new Date(report.created_at);
        return reportDate >= threeHoursAgo;
      });
      setReports(activeReports);
    } catch (error) {
      console.error("Error fetching reports:", error);
      setReports([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Load reports on component mount
  useEffect(() => {
    fetchReports();
  }, []);

  // Handle fast report submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user?.id) {
      setSubmitError("You must be signed in to submit reports");
      return;
    }

    // Validate form
    if (!formData.number.trim() || !formData.location.trim() || !formData.problem.trim()) {
      setSubmitError("Please fill in all fields");
      return;
    }

    setIsSubmitting(true);
    setSubmitError("");
    setSubmitSuccess(false);

    try {
      const response = await fetch("/api/reports", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          number: formData.number.trim(),
          location: formData.location.trim(),
          problem: formData.problem.trim(),
          user_id: user.id,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to submit report");
      }

      // Success - reset form and refresh reports
      setFormData({ number: "", location: "", problem: "" });
      setSubmitSuccess(true);
      setShowForm(false);
      
      // Refresh reports list
      await fetchReports();

      // Hide success message after 2 seconds
      setTimeout(() => {
        setSubmitSuccess(false);
      }, 2000);
    } catch (error: any) {
      setSubmitError(error.message || "Failed to submit report");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (field: keyof typeof formData, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
    setSubmitError(""); // Clear error when user types
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-500 to-green-500 rounded-2xl p-8 text-white shadow-lg">
        <h2 className="text-3xl font-bold mb-2">Live Reports</h2>
        <p className="text-white opacity-95">Community-driven real-time updates</p>
      </div>

      {/* Fast Report Section */}
      <div className="bg-white rounded-2xl p-6 shadow-lg">
        {!showForm ? (
          <div className="text-center py-4">
            <p className="text-gray-600 mb-4 font-medium">
              Share real-time updates quickly and easily
            </p>
            {!isAuthenticated && (
              <p className="text-sm text-amber-600 mb-4 font-medium">
                You need to be signed in to submit reports
              </p>
            )}
            <button
              onClick={() => setShowForm(true)}
              disabled={!isAuthenticated}
              className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-500 to-green-500 text-white rounded-xl hover:from-blue-600 hover:to-green-600 transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg"
            >
              <Plus size={20} />
              Quick Report
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-blue-600">Quick Report</h3>
              <button
                onClick={() => {
                  setShowForm(false);
                  setFormData({ number: "", location: "", problem: "" });
                  setSubmitError("");
                }}
                className="text-gray-500 hover:text-gray-700 transition-colors p-2 rounded-full hover:bg-gray-100"
              >
                <X size={20} />
              </button>
            </div>

            {submitSuccess && (
              <div className="p-3 bg-green-100 border border-green-400 text-green-700 rounded-lg">
                ✅ Report submitted successfully!
              </div>
            )}

            {submitError && (
              <div className="p-3 bg-red-100 border border-red-400 text-red-700 rounded-lg">
                {submitError}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Number / Route *
                  </label>
                  <input
                    type="text"
                    value={formData.number}
                    onChange={(e) => handleInputChange("number", e.target.value)}
                    placeholder="e.g., 86, 19, A123"
                    className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all text-gray-900 font-medium"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Location *
                  </label>
                  <input
                    type="text"
                    value={formData.location}
                    onChange={(e) => handleInputChange("location", e.target.value)}
                    placeholder="e.g., Bourke St / Swanston St"
                    className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all text-gray-900 font-medium"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Problem / Issue *
                </label>
                <textarea
                  value={formData.problem}
                  onChange={(e) => handleInputChange("problem", e.target.value)}
                  placeholder="Describe the issue quickly..."
                  rows={3}
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all resize-none text-gray-900 font-medium"
                  required
                />
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-500 to-green-500 text-white rounded-lg hover:from-blue-600 hover:to-green-600 transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg"
                >
                  {isSubmitting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Submitting...
                    </>
                  ) : (
                    <>
                      <Send size={18} />
                      Submit Report
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    setFormData({ number: "", location: "", problem: "" });
                    setSubmitError("");
                  }}
                  className="px-6 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl p-6 shadow-lg">
          <div className="flex items-center gap-3 mb-2">
            <MapPin className="text-blue-500" size={24} />
            <h3 className="text-lg font-semibold text-gray-900">Total Reports</h3>
          </div>
          <div className="text-3xl font-bold text-gray-900">{reports.length}</div>
          <p className="text-sm text-gray-600 font-medium mt-1">All time</p>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-lg">
          <div className="flex items-center gap-3 mb-2">
            <TrendingUp className="text-green-500" size={24} />
            <h3 className="text-lg font-semibold text-gray-900">Recent Reports</h3>
          </div>
          <div className="text-3xl font-bold text-gray-900">
            {reports.filter((r) => {
              const reportDate = new Date(r.created_at);
              const today = new Date();
              const diffTime = Math.abs(today.getTime() - reportDate.getTime());
              const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
              return diffDays <= 7;
            }).length}
          </div>
          <p className="text-sm text-gray-600 font-medium mt-1">Last 7 days</p>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-lg">
          <div className="flex items-center gap-3 mb-2">
            <AlertCircle className="text-orange-500" size={24} />
            <h3 className="text-lg font-semibold text-gray-900">Active Now</h3>
          </div>
          <div className="text-3xl font-bold text-gray-900">
            {reports.filter((r) => {
              const reportDate = new Date(r.created_at);
              const now = new Date();
              const diffMinutes = Math.floor((now.getTime() - reportDate.getTime()) / (1000 * 60));
              return diffMinutes <= 60;
            }).length}
          </div>
          <p className="text-sm text-gray-600 font-medium mt-1">Last hour</p>
        </div>
      </div>

      {/* Reports List */}
      <div className="bg-white rounded-2xl p-6 shadow-lg">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-gray-900">Recent Reports</h3>
          <button
            onClick={fetchReports}
            disabled={isLoading}
            className="inline-flex items-center gap-2 px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors font-medium"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            <span className="ml-3 text-gray-600 font-medium">Loading reports...</span>
          </div>
        ) : reports.length === 0 ? (
          <div className="text-center py-12">
            <AlertCircle className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <p className="text-gray-600 font-medium">No reports yet.</p>
            <p className="text-sm text-gray-500 mt-1">Be the first to submit a report!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {reports.map((report) => (
              <div
                key={report.id}
                className="border border-gray-200 rounded-xl p-5 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <MapPin className="text-gray-600" size={18} />
                      <h4 className="font-semibold text-gray-900">#{report.number}</h4>
                      <span className="text-gray-400">•</span>
                      <span className="text-gray-700 font-medium">{report.location}</span>
                    </div>
                    <p className="text-gray-800 text-sm mb-3 font-medium">{report.problem}</p>
                    <div className="flex items-center gap-4 text-sm text-gray-600">
                      <div className="flex items-center gap-1">
                        <Clock size={14} />
                        <span>{report.time_ago || "Recently"}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
