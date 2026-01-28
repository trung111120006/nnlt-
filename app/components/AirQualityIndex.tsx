"use client";

import { useState, useEffect } from "react";

interface AirQualityIndexProps {
  // General place (e.g. city) used for API queries
  // We intentionally ignore precise GPS here and always use this broader area.
  location?: string;
}

interface AirQualityData {
  current?: {
    aqi: number; // 1-5 scale
    aqi_us: number; // US AQI 0-500
    main_pollutant: string;
    level?: string;
    components: {
      pm2_5?: number;
      pm10?: number;
      o3?: number;
      no2?: number;
      so2?: number;
      co?: number;
    };
  };
}

function getAQIDescription(aqi: number): string {
  if (aqi <= 50) return "Air quality is satisfactory, and air pollution poses little or no risk.";
  if (aqi <= 100) return "Air quality is acceptable for most people. However, sensitive groups may experience minor respiratory symptoms.";
  if (aqi <= 150) return "Members of sensitive groups may experience health effects. The general public is less likely to be affected.";
  if (aqi <= 200) return "Everyone may begin to experience health effects; members of sensitive groups may experience more serious health effects.";
  return "Health alert: everyone may experience more serious health effects.";
}

export function AirQualityIndex({ location = "Hanoi, Vietnam" }: AirQualityIndexProps) {
  const [airQualityData, setAirQualityData] = useState<AirQualityData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Normalize a potentially very specific location string (e.g. "Long Bien, Hanoi, Vietnam")
  // into a broader city-level location for AQI queries (e.g. "Hanoi, Vietnam").
  const getCityLevelLocation = (raw: string): string => {
    const parts = raw
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean);

    if (parts.length >= 3) {
      // Use the last two segments (usually "City, Country")
      return `${parts[parts.length - 2]}, ${parts[parts.length - 1]}`;
    }

    if (parts.length === 2) {
      // Already "City, Country"
      return `${parts[0]}, ${parts[1]}`;
    }

    return raw.trim();
  };

  useEffect(() => {
    const fetchAirQuality = async () => {
      setLoading(true);
      setError(null);
      try {
        // Always query by general place (city) for AQI. This gives
        // more reliable data than very precise GPS points.
        const cityLocation = getCityLevelLocation(location);
        const response = await fetch(
          `/api/weather?location=${encodeURIComponent(cityLocation)}`
        );
        const data = await response.json();
        
        if (!response.ok) {
          throw new Error(data.error || data.details || "Failed to fetch air quality data");
        }

        if (data.error) {
          throw new Error(data.error);
        }

        // Some locations (especially precise GPS points) may not have AQ data.
        // In that case, we keep a neutral UI instead of showing an error.
        if (data.air_quality) {
          setAirQualityData(data.air_quality);
        } else {
          setAirQualityData(null);
        }
      } catch (err: any) {
        setError(err.message || "Failed to load air quality data");
        console.error("Air quality fetch error:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchAirQuality();
  }, [location]);

  const getStatusColor = (aqi: number) => {
    if (aqi <= 50) return { bg: "bg-green-500", text: "text-green-700", label: "Good", border: "border-green-500" };
    if (aqi <= 100) return { bg: "bg-yellow-500", text: "text-yellow-700", label: "Moderate", border: "border-yellow-500" };
    if (aqi <= 150) return { bg: "bg-orange-500", text: "text-orange-700", label: "Unhealthy for Sensitive Groups", border: "border-orange-500" };
    if (aqi <= 200) return { bg: "bg-red-500", text: "text-red-700", label: "Unhealthy", border: "border-red-500" };
    return { bg: "bg-purple-500", text: "text-purple-700", label: "Hazardous", border: "border-purple-500" };
  };


  // Get current AQI - use aqi_us directly (0-500 scale)
  const currentAqi = airQualityData?.current?.aqi_us ?? 0;
  const currentColorInfo = getStatusColor(currentAqi);
  const currentDescription = getAQIDescription(currentAqi);
  const mainPollutant = airQualityData?.current?.main_pollutant || 'pm2.5';

  if (loading) {
    return (
      <div className="bg-white rounded-2xl p-6 shadow-lg">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
            <p className="text-gray-800 font-medium">Loading air quality data...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-2xl p-6 shadow-lg">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <p className="text-red-500">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  // Graceful fallback UI when the API responds successfully but has no AQ data
  if (!airQualityData?.current) {
    return (
      <div className="bg-white rounded-2xl p-6 shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-xl font-bold text-gray-900">Air Quality Index</h3>
            <p className="text-sm text-gray-700 font-medium">
              Live air quality data is not available for this exact location.
            </p>
          </div>
        </div>
        <p className="text-sm text-gray-700 font-medium mb-3">
          Below is the standard AQI scale for reference.
        </p>
        <div className="flex h-8 rounded-lg overflow-hidden">
          <div className="flex-1 bg-green-500"></div>
          <div className="flex-1 bg-yellow-500"></div>
          <div className="flex-1 bg-orange-500"></div>
          <div className="flex-1 bg-red-500"></div>
          <div className="flex-1 bg-purple-500"></div>
        </div>
        <div className="flex justify-between text-xs text-gray-800 font-medium mt-1">
          <span>0-50</span>
          <span>50-100</span>
          <span>100-150</span>
          <span>150-200</span>
          <span>200+</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl p-6 shadow-lg">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-xl font-bold text-gray-900">Air Quality Index</h3>
          <p className="text-sm text-gray-700 font-medium">Current Conditions</p>
        </div>
      </div>

      {/* Current AQI Display */}
      <div className="flex flex-col md:flex-row items-center gap-6 mb-6">
        {/* Circular Gauge */}
        <div className="relative w-32 h-32">
          <svg className="transform -rotate-90 w-32 h-32">
            <circle
              cx="64"
              cy="64"
              r="56"
              stroke="currentColor"
              strokeWidth="12"
              fill="none"
              className="text-gray-200"
            />
            <circle
              cx="64"
              cy="64"
              r="56"
              stroke="currentColor"
              strokeWidth="12"
              fill="none"
              strokeDasharray={`${(currentAqi / 300) * 352} 352`}
              className={currentColorInfo.text}
              strokeLinecap="round"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className={`text-3xl font-bold ${currentColorInfo.text}`}>{currentAqi}</div>
            <div className="text-xs text-gray-700 font-medium">AQI</div>
          </div>
        </div>

        {/* Status Info */}
        <div className="flex-1">
          <div className={`inline-block px-4 py-2 rounded-full ${currentColorInfo.bg} bg-opacity-25 border-2 ${currentColorInfo.border} mb-3`}>
            <span className={`font-bold ${currentColorInfo.text}`}>{currentColorInfo.label}</span>
          </div>
          <p className="text-gray-800 text-sm font-medium">{currentDescription}</p>
          {mainPollutant && (
            <p className="text-xs text-gray-700 mt-1 font-medium">
              Main Pollutant: <span className="font-bold">{mainPollutant.toUpperCase()}</span>
            </p>
          )}
          {airQualityData?.current?.components && (
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-gray-700 font-medium">
              <div>PM2.5: {airQualityData.current.components.pm2_5?.toFixed(1) || 'N/A'} μg/m³</div>
              <div>PM10: {airQualityData.current.components.pm10?.toFixed(1) || 'N/A'} μg/m³</div>
              <div>O₃: {airQualityData.current.components.o3?.toFixed(1) || 'N/A'} μg/m³</div>
              <div>NO₂: {airQualityData.current.components.no2?.toFixed(1) || 'N/A'} μg/m³</div>
            </div>
          )}
        </div>
      </div>


      {/* AQI Scale */}
      <div>
        <p className="text-sm font-semibold text-gray-900 mb-2">AQI Scale</p>
        <div className="flex h-8 rounded-lg overflow-hidden">
          <div className="flex-1 bg-green-500"></div>
          <div className="flex-1 bg-yellow-500"></div>
          <div className="flex-1 bg-orange-500"></div>
          <div className="flex-1 bg-red-500"></div>
          <div className="flex-1 bg-purple-500"></div>
        </div>
        <div className="flex justify-between text-xs text-gray-800 font-medium mt-1">
          <span>0-50</span>
          <span>50-100</span>
          <span>100-150</span>
          <span>150-200</span>
          <span>200+</span>
        </div>
      </div>
    </div>
  );
}

