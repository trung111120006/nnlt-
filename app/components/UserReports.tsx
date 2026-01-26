"use client";

import { useState, useEffect } from "react";
import { MapPin, Calendar, TrendingUp, AlertCircle, Plus, X, RefreshCw, Send, Clock, Car, CloudFog, Droplets, Info } from "lucide-react";
import { GoogleMap, Marker, InfoWindow } from "@react-google-maps/api";
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
  type?: 'traffic' | 'pollution' | 'flood' | 'other';
  lat?: number;
  lng?: number;
}

const REPORT_TYPES = [
  { id: 'traffic', label: 'Traffic Jam', icon: Car, color: 'text-orange-500', bg: 'bg-orange-100' },
  { id: 'pollution', label: 'Pollution', icon: CloudFog, color: 'text-red-500', bg: 'bg-red-100' },
  { id: 'flood', label: 'Flood / Rain', icon: Droplets, color: 'text-blue-500', bg: 'bg-blue-100' },
  { id: 'other', label: 'Other Issue', icon: Info, color: 'text-gray-500', bg: 'bg-gray-100' },
];

const defaultCenter = { lat: 21.0285, lng: 105.8542 }; // Hanoi

export function UserReports() {
  const { user } = useAuth();
  const isAuthenticated = !!user;
  const [reports, setReports] = useState<Report[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [submitSuccess, setSubmitSuccess] = useState(false);
  
  // Map state
  const [selectedLocation, setSelectedLocation] = useState<{lat: number, lng: number} | null>(null);
  const [activeMarker, setActiveMarker] = useState<Report | null>(null);

  // Fast report form state
  const [formData, setFormData] = useState({
    number: "",
    location: "",
    problem: "",
    type: "other",
  });

  // Fetch reports from database
  const fetchReports = async () => {
    try {
      setIsLoading(true);
      const response = await fetch("/api/reports");
      
      if (!response.ok) {
        setReports([]);
        return;
      }

      const data = await response.json();
      // Filter out reports older than 24 hours (increased from 3h for better demo)
      const now = new Date();
      const cutoffTime = new Date(now.getTime() - 3 * 60 * 60 * 1000);
      const activeReports = (data.reports || []).filter((report: Report) => {
        const reportDate = new Date(report.created_at);
        return reportDate >= cutoffTime;
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
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          number: formData.number.trim(),
          location: formData.location.trim(),
          problem: formData.problem.trim(),
          type: formData.type,
          user_id: user.id,
          lat: selectedLocation?.lat,
          lng: selectedLocation?.lng,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to submit report");
      }

      // Success
      setFormData({ number: "", location: "", problem: "", type: "other" });
      setSelectedLocation(null);
      setSubmitSuccess(true);
      setShowForm(false);
      
      await fetchReports();

      setTimeout(() => {
        setSubmitSuccess(false);
      }, 3000);
    } catch (error: any) {
      setSubmitError(error.message || "Failed to submit report");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (field: keyof typeof formData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setSubmitError("");
  };

  const handleMapClick = (e: google.maps.MapMouseEvent) => {
    if (e.latLng) {
      const lat = e.latLng.lat();
      const lng = e.latLng.lng();
      setSelectedLocation({ lat, lng });
      
      // Reverse geocoding
      const geocoder = new google.maps.Geocoder();
      geocoder.geocode({ location: { lat, lng } }, (results, status) => {
        if (status === "OK" && results && results[0]) {
          handleInputChange("location", results[0].formatted_address);
        } else {
          // Fallback to coordinates if geocoding fails
          handleInputChange("location", `${lat.toFixed(4)}, ${lng.toFixed(4)}`);
        }
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-500 to-green-500 rounded-2xl p-8 text-white shadow-lg">
        <h2 className="text-3xl font-bold mb-2">Live Reports</h2>
        <p className="text-white opacity-95">Community-driven real-time updates</p>
      </div>

      {/* Fast Report Form */}
      <div className="bg-white rounded-2xl p-6 shadow-lg">
        {!showForm ? (
          <div className="text-center py-4">
            <p className="text-gray-600 mb-4 font-medium">
              Share real-time updates regarding traffic, pollution, or other issues.
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
              Create New Report
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-blue-600">New Report</h3>
              <button
                onClick={() => {
                  setShowForm(false);
                  setFormData({ number: "", location: "", problem: "", type: "other" });
                  setSubmitError("");
                }}
                className="text-gray-500 hover:text-gray-700 p-2 rounded-full hover:bg-gray-100"
              >
                <X size={20} />
              </button>
            </div>

            {submitError && (
              <div className="p-3 bg-red-100 border border-red-400 text-red-700 rounded-lg">
                {submitError}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Left Column: Form Fields */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Report Type</label>
                    <div className="grid grid-cols-2 gap-2">
                       {REPORT_TYPES.map((type) => (
                         <button
                           key={type.id}
                           type="button"
                           onClick={() => handleInputChange('type', type.id)}
                           className={`flex items-center gap-2 p-2 rounded-lg border ${
                             formData.type === type.id 
                               ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500' 
                               : 'border-gray-200 hover:bg-gray-50'
                           }`}
                         >
                           <type.icon size={18} className={type.color} />
                           <span className="text-sm font-medium text-gray-700">{type.label}</span>
                         </button>
                       ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Number / Route *</label>
                    <input
                      type="text"
                      value={formData.number}
                      onChange={(e) => handleInputChange("number", e.target.value)}
                      placeholder="e.g., Line 01, H1"
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-gray-900 font-medium"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Location Name *</label>
                    <input
                      type="text"
                      value={formData.location}
                      onChange={(e) => handleInputChange("location", e.target.value)}
                      placeholder="e.g., Near City Center"
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-gray-900 font-medium"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Description *</label>
                    <textarea
                      value={formData.problem}
                      onChange={(e) => handleInputChange("problem", e.target.value)}
                      placeholder="Describe the issue..."
                      rows={2}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-gray-900 font-medium"
                      required
                    />
                  </div>
                </div>

                {/* Right Column: Mini Map Picker */}
                <div className="h-[400px] md:h-auto rounded-xl overflow-hidden border border-gray-300 relative">
                  <div className="absolute top-2 left-2 z-10 bg-white/90 px-3 py-1 rounded text-xs font-semibold shadow">
                    Click map to pin location (optional)
                  </div>
                  <GoogleMap
                    mapContainerStyle={{ width: "100%", height: "100%" }}
                    center={defaultCenter}
                    zoom={12}
                    onClick={handleMapClick}
                    options={{ disableDefaultUI: true, zoomControl: true }}
                  >
                    {selectedLocation && (
                       <Marker position={selectedLocation} />
                    )}
                  </GoogleMap>
                </div>
              </div>

              <div className="flex items-center gap-3 pt-4 border-t">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all font-medium disabled:opacity-50 shadow-md"
                >
                  {isSubmitting ? "Submitting..." : "Submit Report"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-6 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}
      </div>

      {/* Main Map View */}
      <div className="bg-white rounded-2xl p-6 shadow-lg overflow-hidden">
        <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
          <MapPin className="text-blue-500" />
          Community Reports Map
        </h3>
        <div className="h-[400px] w-full rounded-xl overflow-hidden border border-gray-200">
             <GoogleMap
               mapContainerStyle={{ width: "100%", height: "100%" }}
               center={defaultCenter}
               zoom={11}
               options={{
                 disableDefaultUI: false,
                 zoomControl: true,
                 mapTypeControl: false,
                 streetViewControl: false,
               }}
             >
               {reports.map((report) => {
                 // Use lat/lng if available, otherwise skip marker (or use dummy logic if needed)
                 if (!report.lat || !report.lng) return null;
                 
                 const typeStyle = REPORT_TYPES.find(t => t.id === (report.type || 'other')) || REPORT_TYPES[3];
                 
                 // Note: Google Maps Marker 'icon' support for SVGs is tricky without custom SVG paths.
                 // For now, we'll use default markers but maybe we can customize color if using specific icon URLs.
                 // Simple approach: Use default marker. User interacts to see details.
                 
                 return (
                   <Marker
                     key={report.id}
                     position={{ lat: report.lat, lng: report.lng }}
                     onClick={() => setActiveMarker(report)}
                     // To customize marker color, we would need custom icon assets.
                     // Omitting custom icon for stability now.
                   />
                 );
               })}

               {activeMarker && (
                 <InfoWindow
                   position={{ lat: activeMarker.lat!, lng: activeMarker.lng! }}
                   onCloseClick={() => setActiveMarker(null)}
                 >
                   <div className="p-2 min-w-[200px]">
                     <div className="flex items-center gap-2 mb-2 pb-2 border-b">
                       <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase
                         ${activeMarker.type === 'pollution' ? 'bg-red-100 text-red-600' : 
                           activeMarker.type === 'traffic' ? 'bg-orange-100 text-orange-600' :
                           activeMarker.type === 'flood' ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-600'}
                       `}>
                         {activeMarker.type || 'Report'}
                       </span>
                       <span className="text-xs text-gray-500">{activeMarker.time_ago}</span>
                     </div>
                     <h4 className="font-bold text-gray-900">#{activeMarker.number}</h4>
                     <p className="text-sm text-gray-700 mb-1">{activeMarker.location}</p>
                     <p className="text-sm font-medium text-gray-900">{activeMarker.problem}</p>
                   </div>
                 </InfoWindow>
               )}
             </GoogleMap>
        </div>
      </div>

      {/* Recent Reports List */}
      <div className="bg-white rounded-2xl p-6 shadow-lg">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-gray-900">Recent Activity</h3>
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
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          </div>
        ) : reports.length === 0 ? (
          <div className="text-center py-12 text-gray-500">No recent reports found.</div>
        ) : (
          <div className="space-y-4">
            {reports.map((report) => {
               const typeInfo = REPORT_TYPES.find(t => t.id === (report.type || 'other')) || REPORT_TYPES[3];
               const Icon = typeInfo.icon;
               
               return (
                <div key={report.id} className="border border-gray-100 rounded-xl p-4 hover:shadow-md transition-shadow bg-gray-50/50">
                  <div className="flex items-start gap-4">
                    <div className={`p-3 rounded-full shrink-0 ${typeInfo.bg}`}>
                      <Icon className={typeInfo.color} size={24} />
                    </div>
                    <div className="flex-1">
                      <div className="flex justify-between items-start">
                        <h4 className="font-bold text-gray-900 line-clamp-1">{report.location}</h4>
                        <span className="text-xs text-gray-500 whitespace-nowrap ml-2">{report.time_ago}</span>
                      </div>
                      <div className="text-sm text-blue-600 font-medium mb-1">
                        {typeInfo.label} • Map ID: {report.number}
                      </div>
                      <p className="text-gray-700 text-sm">{report.problem}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
