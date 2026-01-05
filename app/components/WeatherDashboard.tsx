"use client";

import { useState } from "react";
import { Search, Wind, Droplets, Eye, Gauge, Sun, Cloud } from "lucide-react";
import { CurrentWeather } from "./CurrentWeather";
import { AirQualityIndex } from "./AirQualityIndex";
import { RegionalAirQuality } from "./RegionalAirQuality";
import { Forecast } from "./Forecast";
import { TemperatureChart } from "./TemperatureChart";
import { UnitToggle } from "./UnitToggle";
import { WeatherMap } from "./WeatherMap";

export function WeatherDashboard() {
  const [searchQuery, setSearchQuery] = useState("");
  const [location, setLocation] = useState("Hanoi, Vietnam");
  const [unit, setUnit] = useState<"°F" | "°C" | "K">("°C");

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      setLocation(searchQuery.trim());
      setSearchQuery("");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-blue-500 to-green-500 rounded-2xl p-8 text-white shadow-lg">
        <h2 className="text-3xl font-bold mb-2">Weather & Air Quality</h2>
        <p className="text-white opacity-95">Real-time conditions and forecasts</p>
      </div>

      {/* Search Bar */}
      <form onSubmit={handleSearch} className="flex gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search any city or location..."
            className="w-full pl-12 pr-4 py-4 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
          />
        </div>
        <button
          type="submit"
          className="px-8 py-4 bg-blue-500 text-white rounded-xl hover:bg-blue-600 transition-colors font-medium"
        >
          Search
        </button>
      </form>

      {/* Location Display */}
      <p className="text-gray-800 text-sm font-medium">{location}</p>

      {/* Unit Toggle */}
      <div className="flex justify-end">
        <UnitToggle unit={unit} setUnit={setUnit} />
      </div>

      {/* Weather Map - Prominent Display */}
      <WeatherMap location={location} unit={unit} />

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Main Weather & AQI */}
        <div className="lg:col-span-2 space-y-6">
          {/* Current Weather */}
          <CurrentWeather location={location} unit={unit} />

          {/* Air Quality Index */}
          <AirQualityIndex location={location} />

          {/* 7-Day Forecast */}
          <Forecast location={location} unit={unit} />
        </div>

        {/* Right Column - Regional Air Quality */}
        <div className="lg:col-span-1">
          <RegionalAirQuality />
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-1 gap-6">
        <TemperatureChart location={location} unit={unit} />
      </div>
    </div>
  );
}

