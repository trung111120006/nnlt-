"use client";

import { useState, useEffect } from "react";
import { Search, MapPin } from "lucide-react";
import { CurrentWeather } from "./CurrentWeather";
import { AirQualityIndex } from "./AirQualityIndex";
import { RegionalAirQuality } from "./RegionalAirQuality";
import { Forecast } from "./Forecast";
import { TemperatureChart } from "./TemperatureChart";
import { UnitToggle } from "./UnitToggle";
import { WeatherMap } from "./WeatherMap";

export function WeatherDashboard() {
  const [searchQuery, setSearchQuery] = useState("");
  // location: value used for API queries (general place, like city)
  const [location, setLocation] = useState("Hanoi, Vietnam");
  // locationDisplay: more detailed label for UI (street, district, etc.)
  const [locationDisplay, setLocationDisplay] = useState("Hanoi, Vietnam");
  const [unit, setUnit] = useState<"°F" | "°C" | "K">("°C");
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [geoCoords, setGeoCoords] = useState<{ lat: number; lon: number } | null>(null);

  // Persist the last chosen location so other parts of the app (like Live Reports)
  // can prefill with the same place.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!locationDisplay) return;
    try {
      window.localStorage.setItem("airweather:lastLocationName", locationDisplay);
    } catch {
      // Ignore storage errors
    }
  }, [locationDisplay]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      setLocation(searchQuery.trim());
      setLocationDisplay(searchQuery.trim());
      setSearchQuery("");
      setGeoError(null);
      // For manual search, clear any previously locked GPS coords
      setGeoCoords(null);
    }
  };

  const handleUseMyLocation = () => {
    if (!navigator.geolocation) {
      setGeoError("Geolocation is not supported by this browser.");
      return;
    }

    setGeoLoading(true);
    setGeoError(null);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude } = position.coords;
          setGeoCoords({ lat: latitude, lon: longitude });
          // Ask backend for weather by coordinates to resolve a friendly location name
          const response = await fetch(
            `/api/weather?lat=${latitude}&lon=${longitude}&forecast=true`
          );
          const data = await response.json();

          if (!response.ok || data.error) {
            throw new Error(data.error || data.details || "Failed to detect your location");
          }

          // Build a reasonable fallback name from weather/air APIs
          const nameParts = [
            data.location?.name,
            data.location?.region,
            data.location?.country,
          ]
            .map((part: string | undefined) => part?.trim())
            .filter(Boolean);

          let fallbackName: string;
          if (nameParts.length > 0) {
            // Ensure uniqueness of parts while preserving order
            const uniqueParts: string[] = [];
            for (const part of nameParts as string[]) {
              if (!uniqueParts.includes(part)) uniqueParts.push(part);
            }
            fallbackName = uniqueParts.join(", ");
          } else {
            fallbackName = `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
          }

          // Set initial name immediately for both API and UI
          setLocation(fallbackName);
          setLocationDisplay(fallbackName);

          // Then try to refine it with Google Maps reverse geocoding
          try {
            if (typeof window !== "undefined") {
              const g = (window as any).google;
              if (g?.maps?.Geocoder) {
                const geocoder = new g.maps.Geocoder();
                geocoder.geocode(
                  { location: { lat: latitude, lng: longitude } },
                  (results: any, status: string) => {
                    if (
                      status === "OK" &&
                      results &&
                      results[0] &&
                      results[0].formatted_address
                    ) {
                      // This usually contains street, district, city, country.
                      // Use it only for display; keep `location` (API query) as the general place.
                      setLocationDisplay(results[0].formatted_address as string);
                    }
                  }
                );
              }
            }
          } catch {
            // If reverse geocoding fails, we keep the fallback name
          }
        } catch (error: any) {
          console.error("Geolocation weather error:", error);
          setGeoError(error.message || "Unable to detect your location");
        } finally {
          setGeoLoading(false);
        }
      },
      (error) => {
        console.error("Geolocation error:", error);
        if (error.code === error.PERMISSION_DENIED) {
          setGeoError("Location permission was denied. You can still search by city name.");
        } else {
          setGeoError("Unable to get your location. Please try again or search by city.");
        }
        setGeoLoading(false);
      }
    );
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-blue-500 to-green-500 rounded-2xl p-8 text-white shadow-lg">
        <h2 className="text-3xl font-bold mb-2">Weather & Air Quality</h2>
        <p className="text-white opacity-95">Real-time conditions and forecasts</p>
      </div>

      {/* Search Bar + Use My Location */}
      <div className="space-y-2">
        <form onSubmit={handleSearch} className="flex flex-col md:flex-row gap-3">
          <div className="flex-1 relative">
            <Search
              className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400"
              size={20}
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search any city or location..."
              className="w-full pl-12 pr-4 py-4 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              className="flex-1 md:flex-none px-6 py-4 bg-blue-500 text-white rounded-xl hover:bg-blue-600 transition-colors font-medium"
            >
              Search
            </button>
            <button
              type="button"
              onClick={handleUseMyLocation}
              disabled={geoLoading}
              className="flex-1 md:flex-none px-6 py-4 bg-gray-900 text-white rounded-xl hover:bg-gray-800 transition-colors font-medium flex items-center justify-center gap-2 disabled:opacity-60"
            >
              <MapPin size={18} />
              {geoLoading ? "Detecting..." : "Use my location"}
            </button>
          </div>
        </form>

        {/* Location Display + any geolocation error */}
        <div className="flex flex-col gap-1">
          <p className="text-gray-800 text-sm font-medium">
            Current location: <span className="font-semibold">{locationDisplay}</span>
          </p>
          {geoError && (
            <p className="text-xs text-red-500 font-medium">
              {geoError}
            </p>
          )}
        </div>
      </div>

      {/* Unit Toggle */}
      <div className="flex justify-end">
        <UnitToggle unit={unit} setUnit={setUnit} />
      </div>

      {/* Weather Map - Prominent Display */}
      <WeatherMap
        location={location}
        label={locationDisplay}
        unit={unit}
        coords={geoCoords || undefined}
      />

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Main Weather & AQI */}
        <div className="lg:col-span-2 space-y-6">
          {/* Current Weather */}
          <CurrentWeather location={location} unit={unit} coords={geoCoords || undefined} />

          {/* Air Quality Index */}
          <AirQualityIndex location={location} />

          {/* 7-Day Forecast */}
          <Forecast location={location} unit={unit} coords={geoCoords || undefined} />
        </div>

        {/* Right Column - Regional Air Quality */}
        <div className="lg:col-span-1">
          <RegionalAirQuality />
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-1 gap-6">
        <TemperatureChart location={location} unit={unit} coords={geoCoords || undefined} />
      </div>
    </div>
  );
}

