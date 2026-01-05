"use client";

interface UnitToggleProps {
  unit: "°F" | "°C" | "K";
  setUnit: (unit: "°F" | "°C" | "K") => void;
}

export function UnitToggle({ unit, setUnit }: UnitToggleProps) {
  return (
    <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
      {(["°F", "°C", "K"] as const).map((u) => (
        <button
          key={u}
          onClick={() => setUnit(u)}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            unit === u
              ? "bg-white text-blue-600 shadow-sm"
              : "text-gray-700 hover:text-gray-900 font-medium"
          }`}
        >
          {u}
        </button>
      ))}
    </div>
  );
}

