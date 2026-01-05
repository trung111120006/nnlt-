"use client";

import { useState, useEffect } from "react";
import { Cloud } from "lucide-react";

interface ForecastProps {
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
  humidity: number;
  wind_kph: number;
  wind_mph: number;
  pop: number;
}

interface WeatherData {
  forecast?: {
    today: ForecastDay;
    tomorrow: ForecastDay;
    next_days: ForecastDay[];
  };
}

export function Forecast({ location, unit }: ForecastProps) {
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
        console.error("Forecast fetch error:", err);
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

  // Combine all forecast days: today, tomorrow, and next days (only real data from API)
  const allForecastDays: (ForecastDay & { isToday?: boolean })[] = [];
  if (weatherData?.forecast) {
    if (weatherData.forecast.today) {
      allForecastDays.push({ ...weatherData.forecast.today, isToday: true });
    }
    if (weatherData.forecast.tomorrow) {
      allForecastDays.push(weatherData.forecast.tomorrow);
    }
    allForecastDays.push(...weatherData.forecast.next_days);
  }

  // Use all available days (OpenWeatherMap provides 5 days, so we'll show 5 days)
  const forecast = allForecastDays;
  const forecastDaysCount = forecast.length;

  if (loading) {
    return (
      <div className="bg-white rounded-2xl p-6 shadow-lg">
        <h3 className="text-xl font-bold text-gray-900 mb-6">Weather Forecast</h3>
        <div className="flex items-center justify-center h-32">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2"></div>
            <p className="text-gray-700 text-sm font-medium">Loading forecast...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !forecast.length) {
    return (
      <div className="bg-white rounded-2xl p-6 shadow-lg">
        <h3 className="text-xl font-bold text-gray-900 mb-6">Weather Forecast</h3>
        <div className="flex items-center justify-center h-32">
          <div className="text-center">
            <Cloud className="mx-auto mb-2 text-gray-400" size={32} />
            <p className="text-gray-700 text-sm font-medium">{error || "Forecast data unavailable"}</p>
          </div>
        </div>
      </div>
    );
  }

  // Dynamic grid columns based on available days (max 7, but can be less)
  const gridColsClass = forecastDaysCount === 1 ? 'grid-cols-1' :
                        forecastDaysCount === 2 ? 'grid-cols-2' :
                        forecastDaysCount === 3 ? 'grid-cols-3' :
                        forecastDaysCount === 4 ? 'grid-cols-4' :
                        forecastDaysCount === 5 ? 'grid-cols-5' :
                        forecastDaysCount === 6 ? 'grid-cols-6' :
                        'grid-cols-7';

  return (
    <div className="bg-white rounded-2xl p-6 shadow-lg">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-bold text-gray-900">
          {forecastDaysCount} Day Forecast
        </h3>
      </div>
      <div className={`grid ${gridColsClass} gap-3`}>
        {forecast.map((day, index) => {
          const dayName = formatDate(day.date);
          const isToday = day.isToday || index === 0;
          const maxTemp = convertTemp(day.temp_max_c, day.temp_max_f);
          const minTemp = convertTemp(day.temp_min_c, day.temp_min_f);

          return (
            <div
              key={day.date}
              className={`p-4 rounded-xl text-center transition-all ${
                isToday
                  ? "bg-blue-100 border-2 border-blue-500"
                  : "bg-gray-50 hover:bg-gray-100"
              }`}
            >
              <div className="text-sm font-semibold text-gray-800 mb-2">
                {dayName}
              </div>
              {day.condition.icon && (
                <img
                  src={day.condition.icon}
                  alt={day.condition.text}
                  className="mx-auto mb-2 w-12 h-12"
                />
              )}
              <div
                className={`text-lg font-bold mb-1 ${
                  isToday ? "text-blue-700" : "text-gray-900"
                }`}
              >
                {maxTemp !== null ? `${maxTemp}${unit === "K" ? "K" : unit}` : "N/A"}
              </div>
              <div
                className={`text-sm font-medium ${
                  isToday ? "text-blue-700" : "text-gray-700"
                }`}
              >
                {minTemp !== null ? `${minTemp}${unit === "K" ? "K" : unit}` : "N/A"}
              </div>
              {day.pop > 0 && (
                <div className="text-xs text-gray-600 mt-1 font-medium">
                  {day.pop}% rain
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

