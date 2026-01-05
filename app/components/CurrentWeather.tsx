"use client";

import { useState, useEffect } from "react";
import { Wind, Droplets, Eye, Gauge, Sun, Cloud } from "lucide-react";

interface CurrentWeatherProps {
  location: string;
  unit: "°F" | "°C" | "K";
}

interface WeatherData {
  location?: {
    name?: string;
    region?: string;
    country?: string;
  };
  current?: {
    temp_c?: number;
    temp_f?: number;
    feelslike_c?: number;
    feelslike_f?: number;
    condition?: {
      text?: string;
      icon?: string;
    };
    humidity?: number;
    wind_kph?: number;
    wind_mph?: number;
    pressure_mb?: number;
    vis_km?: number;
    vis_miles?: number;
  };
}

export function CurrentWeather({ location, unit }: CurrentWeatherProps) {
  const [weatherData, setWeatherData] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchWeather = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/weather?location=${encodeURIComponent(location)}`);
        const data = await response.json();
        
        if (!response.ok) {
          throw new Error(data.error || data.details || "Failed to fetch weather data");
        }

        if (data.error) {
          throw new Error(data.error);
        }

        setWeatherData(data);
      } catch (err: any) {
        setError(err.message || "Failed to load weather data");
        console.error("Weather fetch error:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchWeather();
  }, [location]);

  const convertTemp = (tempC?: number, tempF?: number) => {
    if (!tempC && !tempF) return null;
    if (unit === "°F") {
      return tempF || Math.round((tempC || 0) * (9 / 5) + 32);
    }
    if (unit === "K") {
      return Math.round((tempC || 0) + 273.15);
    }
    return tempC || Math.round(((tempF || 0) - 32) * (5 / 9));
  };

  const convertWind = (windKph?: number, windMph?: number) => {
    if (!windKph && !windMph) return "N/A";
    if (unit === "°F") {
      return `${windMph || Math.round((windKph || 0) * 0.621371)} mph`;
    }
    return `${windKph || Math.round((windMph || 0) * 1.60934)} km/h`;
  };

  const convertVisibility = (visKm?: number, visMiles?: number) => {
    if (!visKm && !visMiles) return "N/A";
    if (unit === "°F") {
      return `${visMiles || Math.round((visKm || 0) * 0.621371)} mi`;
    }
    return `${visKm || Math.round((visMiles || 0) * 1.60934)} km`;
  };

  const temperature = convertTemp(weatherData?.current?.temp_c, weatherData?.current?.temp_f);
  const feelsLike = convertTemp(weatherData?.current?.feelslike_c, weatherData?.current?.feelslike_f);
  const condition = weatherData?.current?.condition?.text || "Loading...";

  if (loading) {
    return (
      <div className="bg-gradient-to-br from-orange-400 via-pink-500 to-pink-600 rounded-2xl p-8 text-white shadow-lg relative overflow-hidden">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
            <p className="text-white font-medium">Loading weather data...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !weatherData?.current) {
    return (
      <div className="bg-gradient-to-br from-orange-400 via-pink-500 to-pink-600 rounded-2xl p-8 text-white shadow-lg relative overflow-hidden">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <Cloud className="mx-auto mb-4 opacity-50" size={48} />
            <p className="text-white font-medium">{error || "Weather data unavailable"}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-blue-500 via-blue-600 to-indigo-600 rounded-2xl p-8 text-white shadow-xl relative overflow-hidden">
      <div className="absolute top-4 right-4 opacity-20">
        <Sun size={120} />
      </div>
      <div className="relative z-10">
        <h3 className="text-lg font-semibold mb-4">Right Now</h3>
        <div className="flex items-start justify-between mb-6">
          <div>
            {temperature !== null ? (
              <>
                <div className="text-7xl font-bold mb-2">
                  {temperature}{unit === "K" ? "K" : unit}
                </div>
                <p className="text-xl mb-1">{condition}</p>
                {feelsLike !== null && (
                  <p className="text-white opacity-95">Feels like {feelsLike}{unit === "K" ? "K" : unit}</p>
                )}
              </>
            ) : (
              <div className="text-7xl font-bold mb-2">--</div>
            )}
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white/20 backdrop-blur-sm rounded-xl p-4">
            <Wind className="mb-2" size={24} />
            <div className="text-sm font-medium text-white">Wind</div>
            <div className="text-xl font-semibold text-white">
              {convertWind(weatherData.current.wind_kph, weatherData.current.wind_mph)}
            </div>
          </div>
          <div className="bg-white/20 backdrop-blur-sm rounded-xl p-4">
            <Droplets className="mb-2" size={24} />
            <div className="text-sm font-medium text-white">Humidity</div>
            <div className="text-xl font-semibold text-white">
              {weatherData.current.humidity !== undefined ? `${weatherData.current.humidity}%` : "N/A"}
            </div>
          </div>
          <div className="bg-white/20 backdrop-blur-sm rounded-xl p-4">
            <Eye className="mb-2" size={24} />
            <div className="text-sm font-medium text-white">Visibility</div>
            <div className="text-xl font-semibold text-white">
              {convertVisibility(weatherData.current.vis_km, weatherData.current.vis_miles)}
            </div>
          </div>
          <div className="bg-white/20 backdrop-blur-sm rounded-xl p-4">
            <Gauge className="mb-2" size={24} />
            <div className="text-sm font-medium text-white">Pressure</div>
            <div className="text-xl font-semibold text-white">
              {weatherData.current.pressure_mb !== undefined ? `${weatherData.current.pressure_mb} mb` : "N/A"}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

