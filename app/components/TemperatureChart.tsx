"use client";

import { useState, useEffect } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface TemperatureChartProps {
  location: string;
  unit: "°F" | "°C" | "K";
}

interface ForecastDay {
  date: string;
  temp_min_c: number;
  temp_max_c: number;
  temp_min_f: number;
  temp_max_f: number;
  condition: {
    text: string;
    icon: string;
  };
}

interface WeatherData {
  forecast?: {
    today: ForecastDay;
    tomorrow: ForecastDay;
    next_days: ForecastDay[];
  };
}

export function TemperatureChart({ location, unit }: TemperatureChartProps) {
  const [weatherData, setWeatherData] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchForecast = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/weather?location=${encodeURIComponent(location)}&forecast=true`);
        const data = await response.json();
        
        if (!response.ok) {
          throw new Error(data.error || data.details || "Failed to fetch forecast data");
        }

        if (data.error) {
          throw new Error(data.error);
        }

        setWeatherData(data);
      } catch (err: any) {
        setError(err.message || "Failed to load forecast data");
        console.error("Temperature chart fetch error:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchForecast();
  }, [location]);

  const convertTemp = (tempC?: number, tempF?: number) => {
    if (tempC === undefined && tempF === undefined) return null;
    if (unit === "°F") {
      return tempF !== undefined ? tempF : Math.round((tempC || 0) * (9 / 5) + 32);
    }
    if (unit === "K") {
      return Math.round((tempC || 0) + 273.15);
    }
    return tempC !== undefined ? tempC : Math.round(((tempF || 0) - 32) * (5 / 9));
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

  // Combine all forecast days: today, tomorrow, and next 5 days
  const allForecastDays: ForecastDay[] = [];
  if (weatherData?.forecast) {
    if (weatherData.forecast.today) {
      allForecastDays.push(weatherData.forecast.today);
    }
    if (weatherData.forecast.tomorrow) {
      allForecastDays.push(weatherData.forecast.tomorrow);
    }
    allForecastDays.push(...weatherData.forecast.next_days);
  }

  // Limit to 7 days and prepare chart data
  const forecast = allForecastDays.slice(0, 7);
  const chartData = forecast.map((day) => {
    const maxTemp = convertTemp(day.temp_max_c, day.temp_max_f);
    return {
      day: formatDate(day.date),
      temp: maxTemp !== null ? maxTemp : 0,
    };
  });

  // Calculate dynamic Y-axis domain
  const temps = chartData.map(d => d.temp).filter(t => t > 0);
  const minTemp = temps.length > 0 ? Math.min(...temps) : 0;
  const maxTemp = temps.length > 0 ? Math.max(...temps) : 30;
  const padding = (maxTemp - minTemp) * 0.2 || 5;
  const yMin = Math.max(0, Math.floor(minTemp - padding));
  const yMax = Math.ceil(maxTemp + padding);

  if (loading) {
    return (
      <div className="bg-white rounded-2xl p-6 shadow-lg">
        <h3 className="text-xl font-bold text-gray-900 mb-4">
          Temperature Trend ({unit})
        </h3>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2"></div>
            <p className="text-gray-800 text-sm font-medium">Loading temperature data...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !chartData.length) {
    return (
      <div className="bg-white rounded-2xl p-6 shadow-lg">
        <h3 className="text-xl font-bold text-gray-900 mb-4">
          Temperature Trend ({unit})
        </h3>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <p className="text-gray-800 text-sm font-medium">{error || "Temperature data unavailable"}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl p-6 shadow-lg">
      <h3 className="text-xl font-bold text-gray-900 mb-4">
        Temperature Trend ({unit})
      </h3>
      <ResponsiveContainer width="100%" height={250}>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis
            dataKey="day"
            stroke="#6b7280"
            style={{ fontSize: "12px" }}
          />
          <YAxis
            stroke="#6b7280"
            style={{ fontSize: "12px" }}
            domain={[yMin, yMax]}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "#fff",
              border: "1px solid #e5e7eb",
              borderRadius: "8px",
            }}
            formatter={(value: number | undefined) => [`${value || 0}${unit === "K" ? "K" : unit}`, "Temperature"]}
          />
          <Line
            type="monotone"
            dataKey="temp"
            stroke="#3b82f6"
            strokeWidth={3}
            dot={{ fill: "#3b82f6", r: 5 }}
            activeDot={{ r: 7 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

