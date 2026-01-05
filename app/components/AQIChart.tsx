"use client";

import { useState, useEffect } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

interface AQIChartProps {
  location: string;
}

interface AirQualityDay {
  date: string;
  aqi: number; // 1-5 scale
  aqi_us: number; // US AQI 0-500
  main_pollutant: string;
  components?: {
    pm2_5?: number;
    pm10?: number;
    o3?: number;
    no2?: number;
    so2?: number;
    co?: number;
  };
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
  forecast?: AirQualityDay[];
}

interface WeatherData {
  air_quality?: AirQualityData;
}

export function AQIChart({ location }: AQIChartProps) {
  const [weatherData, setWeatherData] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAirQuality = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/weather?location=${encodeURIComponent(location)}&forecast=true`);
        const data = await response.json();
        
        if (!response.ok) {
          throw new Error(data.error || data.details || "Failed to fetch air quality data");
        }

        if (data.error) {
          throw new Error(data.error);
        }

        setWeatherData(data);
      } catch (err: any) {
        setError(err.message || "Failed to load air quality data");
        console.error("AQI chart fetch error:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchAirQuality();
  }, [location]);

  const getBarColor = (aqi: number) => {
    if (aqi <= 50) return "#10b981"; // green
    if (aqi <= 100) return "#eab308"; // yellow
    if (aqi <= 150) return "#f97316"; // orange
    if (aqi <= 200) return "#ef4444"; // red
    return "#a855f7"; // purple
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Check if it's today
    if (date.toDateString() === today.toDateString()) {
      return "Today";
    }
    // Check if it's tomorrow
    if (date.toDateString() === tomorrow.toDateString()) {
      return "Tomorrow";
    }
    // Return day name
    return date.toLocaleDateString('en-US', { weekday: 'short' });
  };

  // Combine current and forecast data for 7-day display
  const allAirQualityDays: AirQualityDay[] = [];
  
  // Add today from current data
  if (weatherData?.air_quality?.current) {
    const todayDate = new Date().toLocaleDateString('en-CA');
    allAirQualityDays.push({
      date: todayDate,
      aqi: weatherData.air_quality.current.aqi,
      aqi_us: weatherData.air_quality.current.aqi_us,
      main_pollutant: weatherData.air_quality.current.main_pollutant,
      components: weatherData.air_quality.current.components,
    });
  }
  
  // Add forecast days
  if (weatherData?.air_quality?.forecast) {
    allAirQualityDays.push(...weatherData.air_quality.forecast);
  }

  // Limit to 7 days and prepare chart data
  const forecast = allAirQualityDays.slice(0, 7);
  const data = forecast.map((day) => ({
    day: formatDate(day.date),
    aqi: day.aqi_us, // Use US AQI scale (0-500)
  }));

  if (loading) {
    return (
      <div className="bg-white rounded-2xl p-6 shadow-lg">
        <h3 className="text-xl font-bold text-gray-900 mb-4">Air Quality Index Trend</h3>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2"></div>
            <p className="text-gray-500 text-sm">Loading air quality data...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !data.length) {
    return (
      <div className="bg-white rounded-2xl p-6 shadow-lg">
        <h3 className="text-xl font-bold text-gray-900 mb-4">Air Quality Index Trend</h3>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <p className="text-gray-500 text-sm">{error || "Air quality data unavailable"}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl p-6 shadow-lg">
      <h3 className="text-xl font-bold text-gray-900 mb-4">Air Quality Index Trend (7 Days)</h3>
      <ResponsiveContainer width="100%" height={250}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis
            dataKey="day"
            stroke="#6b7280"
            style={{ fontSize: "12px" }}
          />
          <YAxis
            stroke="#6b7280"
            style={{ fontSize: "12px" }}
            domain={[0, 500]}
            ticks={[0, 50, 100, 150, 200, 250, 300, 350, 400, 450, 500]}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "#fff",
              border: "1px solid #e5e7eb",
              borderRadius: "8px",
            }}
            formatter={(value: number | undefined) => [`${value || 0} AQI`, "Air Quality"]}
          />
          <Bar dataKey="aqi" radius={[8, 8, 0, 0]}>
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={getBarColor(entry.aqi)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

