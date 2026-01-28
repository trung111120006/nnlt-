"use client";

import { useState, useEffect, useCallback } from "react";
import { GoogleMap, Marker, InfoWindow } from "@react-google-maps/api";
import { MapPin, Thermometer, Droplets, Wind, Eye } from "lucide-react";

interface WeatherData {
  location?: {
    name?: string;
    region?: string;
    country?: string;
    lat?: number;
    lon?: number;
  };
  current?: {
    temp_c?: number;
    temp_f?: number;
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

interface WeatherMapProps {
  location?: string;
  unit?: "°F" | "°C" | "K";
  coords?: { lat: number; lon: number };
}

const mapContainerStyle = {
  width: "100%",
  height: "500px",
};

const defaultCenter = {
  lat: 21.0285, // Hanoi coordinates
  lng: 105.8542,
};

export function WeatherMap({ location = "Hanoi, Vietnam", unit = "°C", coords }: WeatherMapProps) {
  const [weatherData, setWeatherData] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mapCenter, setMapCenter] = useState(defaultCenter);
  const [showInfoWindow, setShowInfoWindow] = useState(true);

  const fetchWeatherData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const url = coords
        ? `/api/weather?lat=${coords.lat}&lon=${coords.lon}`
        : `/api/weather?location=${encodeURIComponent(location)}`;

      const response = await fetch(url);
      const data = await response.json();
      
      if (!response.ok) {
        // Handle rate limiting (429)
        if (response.status === 429) {
          const retryAfter = data.retryAfter || 60;
          throw new Error(
            `Rate limit exceeded. Please wait ${retryAfter} seconds before trying again.`
          );
        }
        // Handle other errors
        throw new Error(data.error || data.details || "Failed to fetch weather data");
      }

      // Check if response has error property (some APIs return 200 with error)
      if (data.error) {
        throw new Error(data.error);
      }

      setWeatherData(data);

      // Update map center if coordinates are available
      if (data.location?.lat && data.location?.lon) {
        setMapCenter({
          lat: data.location.lat,
          lng: data.location.lon,
        });
      }
    } catch (err: any) {
      setError(err.message || "Failed to load weather data");
      console.error("Weather fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, [location, coords]);

  useEffect(() => {
    // If explicit coords are provided (from GPS), favor them for centering immediately
    if (coords) {
      setMapCenter({
        lat: coords.lat,
        lng: coords.lon,
      });
    }
  }, [coords]);

  useEffect(() => {
    fetchWeatherData();
  }, [fetchWeatherData]);

  const convertTemp = (tempC?: number, tempF?: number) => {
    if (!tempC && !tempF) return "N/A";
    if (unit === "°F") {
      return tempF || Math.round((tempC || 0) * (9 / 5) + 32);
    }
    if (unit === "K") {
      return Math.round((tempC || 0) + 273.15);
    }
    return tempC || Math.round(((tempF || 0) - 32) * (5 / 9));
  };

  const googleMapsApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  if (!googleMapsApiKey) {
    return (
      <div className="bg-white rounded-2xl p-8 shadow-lg">
        <p className="text-red-500">Google Maps API key is not configured</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
      <div className="p-6 border-b border-gray-200">
        <h3 className="text-2xl font-bold text-blue-600 flex items-center gap-2">
          <MapPin className="text-blue-500" size={24} />
          Weather Map - {location}
        </h3>
      </div>

      {loading && (
        <div className="h-[500px] flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
            <p className="mt-4 text-gray-800 font-medium">Loading weather data...</p>
          </div>
        </div>
      )}

      {error && (
        <div className="h-[500px] flex items-center justify-center bg-red-50">
          <div className="text-center max-w-md mx-auto p-6">
            <div className="mb-4">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <MapPin className="text-red-500" size={32} />
              </div>
              <p className="text-red-600 font-semibold text-lg mb-2">Unable to Load Weather Data</p>
              <p className="text-red-500 text-sm">{error}</p>
            </div>
            {error.includes("Rate limit") ? (
              <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-yellow-900 text-sm font-medium">
                  ⏱️ You've made too many requests. Please wait a moment before trying again.
                </p>
              </div>
            ) : (
              <button
                onClick={fetchWeatherData}
                className="mt-4 px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors font-medium"
              >
                Retry
              </button>
            )}
          </div>
        </div>
      )}

      {!loading && !error && weatherData && (
        <GoogleMap
          mapContainerStyle={mapContainerStyle}
          center={mapCenter}
          zoom={12}
          options={{
            zoomControl: true,
            streetViewControl: false,
            mapTypeControl: false,
            fullscreenControl: true,
          }}
        >
          {weatherData.location?.lat && weatherData.location?.lon && (
            <>
              <Marker
                position={{
                  lat: weatherData.location.lat,
                  lng: weatherData.location.lon,
                }}
                onClick={() => setShowInfoWindow(true)}
              />
              {showInfoWindow && (
                <InfoWindow
                  position={{
                    lat: weatherData.location!.lat!,
                    lng: weatherData.location!.lon!,
                  }}
                  onCloseClick={() => setShowInfoWindow(false)}
                >
                  <div className="p-2 min-w-[250px]">
                    <h4 className="font-bold text-lg mb-2 text-blue-700">
                      {weatherData.location?.name || location}
                    </h4>
                    {weatherData.current && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Thermometer className="text-red-500" size={18} />
                          <span className="font-semibold text-gray-800">
                            {convertTemp(
                              weatherData.current.temp_c,
                              weatherData.current.temp_f
                            )}
                            {unit === "K" ? "K" : unit}
                          </span>
                          <span className="text-blue-600 text-sm">
                            {weatherData.current.condition?.text}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Droplets className="text-blue-500" size={18} />
                          <span className="text-gray-700">Humidity: {weatherData.current.humidity}%</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Wind className="text-gray-500" size={18} />
                          <span className="text-gray-700">
                            Wind:{" "}
                            {unit === "°F"
                              ? `${weatherData.current.wind_mph || 0} mph`
                              : `${weatherData.current.wind_kph || 0} km/h`}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Eye className="text-gray-500" size={18} />
                          <span className="text-gray-700">
                            Visibility:{" "}
                            {unit === "°F"
                              ? `${weatherData.current.vis_miles || 0} mi`
                              : `${weatherData.current.vis_km || 0} km`}
                          </span>
                        </div>
                        {weatherData.current.pressure_mb && (
                          <div className="text-sm text-gray-700">
                            Pressure: {weatherData.current.pressure_mb} mb
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </InfoWindow>
              )}
            </>
          )}
        </GoogleMap>
      )}

      {/* Weather Info Card below map */}
      {!loading && !error && weatherData?.current && (
        <div className="p-6 bg-gradient-to-br from-blue-50 to-green-50">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <Thermometer className="text-red-500" size={20} />
                <span className="text-sm text-blue-600 font-medium">Temperature</span>
              </div>
              <div className="text-2xl font-bold text-gray-800">
                {convertTemp(weatherData.current.temp_c, weatherData.current.temp_f)}
                {unit === "K" ? "K" : unit}
              </div>
              <div className="text-xs text-blue-600 mt-1">
                {weatherData.current.condition?.text}
              </div>
            </div>
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <Droplets className="text-blue-500" size={20} />
                <span className="text-sm text-blue-600 font-medium">Humidity</span>
              </div>
              <div className="text-2xl font-bold text-gray-800">{weatherData.current.humidity}%</div>
            </div>
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <Wind className="text-gray-500" size={20} />
                <span className="text-sm text-blue-600 font-medium">Wind</span>
              </div>
              <div className="text-2xl font-bold text-gray-800">
                {unit === "°F"
                  ? `${weatherData.current.wind_mph || 0} mph`
                  : `${weatherData.current.wind_kph || 0} km/h`}
              </div>
            </div>
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <Eye className="text-gray-500" size={20} />
                <span className="text-sm text-blue-600 font-medium">Visibility</span>
              </div>
              <div className="text-2xl font-bold text-gray-800">
                {unit === "°F"
                  ? `${weatherData.current.vis_miles || 0} mi`
                  : `${weatherData.current.vis_km || 0} km`}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
