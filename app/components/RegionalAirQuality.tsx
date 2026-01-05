"use client";

import { useState, useEffect } from "react";

interface AQILocation {
  name: string;
  aqi: number;
  status: string;
  color: string;
  updatedAt?: string;
}

export function RegionalAirQuality() {
  const [locations, setLocations] = useState<AQILocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // 4 countries to fetch data for
  const countries = [
    "Bangkok, Thailand",
    "Singapore, Singapore",
    "Tokyo, Japan",
    "Seoul, South Korea",
  ];

  const getAQIStatus = (aqi: number): { status: string; color: string } => {
    if (aqi <= 50) return { status: "Good", color: "green" };
    if (aqi <= 100) return { status: "Moderate", color: "yellow" };
    if (aqi <= 150) return { status: "Unhealthy for Sensitive Groups", color: "orange" };
    if (aqi <= 200) return { status: "Unhealthy", color: "red" };
    return { status: "Hazardous", color: "purple" };
  };

  const getColorClass = (color: string) => {
    const colors: Record<string, string> = {
      green: "bg-green-500",
      yellow: "bg-yellow-500",
      orange: "bg-orange-500",
      red: "bg-red-500",
      purple: "bg-purple-500",
    };
    return colors[color] || colors.yellow;
  };

  const formatTimeAgo = (date: Date): string => {
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours}h ago`;
    
    const diffInDays = Math.floor(diffInHours / 24);
    return `${diffInDays}d ago`;
  };

  useEffect(() => {
    const fetchAirQualityData = async () => {
      setLoading(true);
      try {
        const promises = countries.map(async (country) => {
          try {
            const response = await fetch(`/api/weather?location=${encodeURIComponent(country)}`);
            if (!response.ok) {
              throw new Error(`Failed to fetch data for ${country}`);
            }
            const data = await response.json();
            
            if (data.air_quality?.current) {
              const aqi = data.air_quality.current.aqi_us || 50;
              const { status, color } = getAQIStatus(aqi);
              
              return {
                name: country.split(",")[0], // Get city name
                aqi: aqi,
                status: status,
                color: color,
                updatedAt: new Date().toISOString(),
              };
            }
            return null;
          } catch (error) {
            console.error(`Error fetching data for ${country}:`, error);
            return null;
          }
        });

        const results = await Promise.all(promises);
        const validResults = results.filter((item) => item !== null) as AQILocation[];
        
        // Sort by AQI (highest first)
        validResults.sort((a, b) => b.aqi - a.aqi);
        
        setLocations(validResults);
        setLastUpdated(new Date());
      } catch (error) {
        console.error("Error fetching air quality data:", error);
        // Fallback to default data if API fails
        setLocations([
          { name: "Bangkok", aqi: 95, status: "Moderate", color: "yellow" },
          { name: "Singapore", aqi: 65, status: "Moderate", color: "green" },
          { name: "Tokyo", aqi: 125, status: "Unhealthy", color: "orange" },
          { name: "Seoul", aqi: 45, status: "Good", color: "green" },
        ]);
      } finally {
        setLoading(false);
      }
    };

    fetchAirQualityData();
    
    // Refresh every 10 minutes
    const interval = setInterval(fetchAirQualityData, 10 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const gridData = locations.slice(0, 4);

  return (
    <div className="bg-white rounded-2xl p-6 shadow-lg">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-bold text-gray-900">Regional Air Quality</h3>
        <span className="text-xs text-gray-700 font-medium">
          {lastUpdated ? `Updated ${formatTimeAgo(lastUpdated)}` : "Loading..."}
        </span>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
          <span className="ml-2 text-gray-600 text-sm">Loading data...</span>
        </div>
      ) : (
        <>
          {/* Grid Visualization */}
          <div className="grid grid-cols-2 gap-3 mb-6">
            {gridData.map((item, index) => (
              <div
                key={index}
                className={`${getColorClass(item.color)} rounded-xl p-6 flex items-center justify-center`}
              >
                <div className="text-white text-2xl font-bold">{item.aqi}</div>
              </div>
            ))}
          </div>

          {/* Location List */}
          <div className="space-y-3">
            {locations.map((location, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-3 h-3 rounded-full ${getColorClass(location.color)}`}
                  ></div>
                  <div>
                    <div className="font-semibold text-gray-900">{location.name}</div>
                    <div className="text-sm text-gray-700 font-medium">{location.status}</div>
                  </div>
                </div>
                <div className="text-lg font-bold text-gray-900">AQI {location.aqi}</div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
