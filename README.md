## AirWeather – Real‑time Weather, Air Quality & Community Reports

AirWeather is a Next.js app that shows live weather, air quality, and community reports for your area.  
It’s built for a simple flow: sign in, let the site use your location, and instantly see what the sky and streets look like around you.

### Main features

- **Weather dashboard**
  - Current temperature, feels‑like, humidity, wind, visibility, and pressure.
  - Multi‑day forecast and temperature trends.
  - Unit toggle between °C, °F, and K.

- **Location‑aware map**
  - Uses your browser’s location (with permission) to center a Google Map on you.
  - Weather marker with current conditions at that point.
  - Text label can be a precise address (street / district) while data can come from the broader city.

- **Air Quality Index**
  - Shows AQI, main pollutant, and key components (PM2.5, PM10, O₃, NO₂, etc.).
  - If exact‑point AQ data is missing, it falls back to city‑level data when possible, or shows a neutral AQI scale.

- **Live community reports**
  - Signed‑in users can submit quick reports (traffic, pollution, flooding, other).
  - Each report has a location name, description, type, and optional pin on the map.
  - Recent reports appear on a map and in a list for quick scanning.

- **Authentication & profiles**
  - Email‑based auth with Supabase.
  - Basic user profile and simple chat assistant integrated into the UI.

---

### Tech stack

- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript + React
- **Styling**: Tailwind‑style utility classes (via `@tailwindcss/postcss` / `tailwindcss@4`)
- **Charts**: `recharts` for temperature and trend charts
- **Maps**: `@react-google-maps/api` with Google Maps JavaScript API
- **Auth & data**: Supabase (`@supabase/supabase-js`)
- **Email**: Resend (for notifications/emails)

---

### Prerequisites

You’ll need:

- **Node.js** (LTS recommended)
- A package manager: `npm` (repo uses `npm` + `package-lock.json`)
- The following API keys:
  - `WEATHER_API_KEY` – OpenWeatherMap API key
  - `AIR_QUALITY_API_KEY` – IQAir API key
  - `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` – Google Maps JavaScript API key (with Maps + Geocoding enabled)
  - Supabase URL and anon/public key for auth and data

Create a `.env.local` file in the project root and add at least:

```bash
WEATHER_API_KEY=your_openweather_api_key
AIR_QUALITY_API_KEY=your_iqair_api_key
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_google_maps_api_key
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

Do **not** commit your real keys to Git.

---

### Installation & local development

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Run the development server**

   ```bash
   npm run dev
   ```

3. **Open the app**

   Visit `http://localhost:3000` in your browser.

4. **Sign in**

   - If you’re not signed in, you’ll be redirected to the sign‑in page.
   - After logging in, you’ll land on the main dashboard.

---

### How the location logic works

- When you **search** for a place:
  - The string you type becomes the **query** for all weather/forecast calls.
  - The same text is used as the main display label.

- When you click **“Use my location”**:
  - The browser provides GPS coordinates.
  - Those coordinates are sent to the backend for:
    - Weather + forecast data at that point.
    - Air quality (when available).
  - The map centers exactly on those coordinates.
  - A separate, more detailed **display label** is built from:
    - Weather / AQ APIs (city / region / country), and
    - Google’s reverse‑geocoded `formatted_address` for street / district, when available.
  - Some widgets (like air quality) may intentionally use the **broader city name** for more stable data.

This is why:

- **Map position** matches your actual location.
- **Text label** can be very specific.
- **Data** is sometimes city‑level (for air quality), sometimes point‑level (for weather).

---

### Live reports flow

1. Go to the **“Live Reports”** tab.
2. Click **“Create New Report”**.
3. Fill in:
   - Report type (Traffic, Pollution, Flood, Other)
   - Number / Route
   - Location Name (auto‑filled with your last known place when possible)
   - Description
4. (Optional) Click the small map to pin the exact location.
5. Submit. The new report shows up:
   - As a marker on the community map (if lat/lng are set).
   - In the recent reports list with type, time, and description.

Older reports are automatically filtered out after a short time window so the view stays “live”.

---

### Scripts

- **`npm run dev`** – start the development server.
- **`npm run build`** – create a production build.
- **`npm start`** – run the production build.
- **`npm run lint`** – run ESLint.

---

### Deployment

This is a standard Next.js App Router project and can be deployed to platforms like:

- Vercel
- Netlify
- Any Node‑compatible hosting running `npm run build && npm start`

Make sure to configure all required environment variables in your hosting provider, matching the names in `.env.local`.

---

### Notes & limitations

- Weather and forecast rely on OpenWeatherMap; accuracy depends on their API.
- Air quality data comes from IQAir; some locations may not have coverage.
- Google address precision depends on the Maps/Geocoding API and local mapping quality.

If you run into issues or want to extend the app (e.g., more data sources, different map layers, or more report types), the main entry points are:

- `app/components/WeatherDashboard.tsx`
- `app/components/UserReports.tsx`
- `app/api/weather/route.ts`

