import { NextRequest, NextResponse } from 'next/server';

// TypeScript interfaces
interface CacheEntry {
  data: WeatherResponse;
  timestamp: number;
}

interface AirQualityDay {
  date: string;
  aqi: number;
  aqi_us: number;
  main_pollutant: string;
  components: {
    pm2_5?: number;
    pm10?: number;
    o3?: number;
    no2?: number;
    so2?: number;
    co?: number;
  };
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

interface WeatherResponse {
  location: {
    name: string;
    region?: string;
    country?: string;
    lat?: number;
    lon?: number;
  };
  current: {
    temp_c?: number;
    temp_f?: number;
    feelslike_c?: number;
    feelslike_f?: number;
    condition: {
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
  forecast?: {
    today: ForecastDay;
    tomorrow: ForecastDay;
    next_days: ForecastDay[];
  };
  air_quality?: {
    current?: {
      aqi: number;
      aqi_us: number;
      main_pollutant: string;
      level: string;
      components: any;
    };
    forecast?: AirQualityDay[];
  };
}

// Simple in-memory cache
const cache = new Map<string, CacheEntry>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Convert US AQI (0-500) to 1-5 scale
function convertUSAQIToScale(usAqi: number): number {
  if (usAqi <= 50) return 1;   // Good
  if (usAqi <= 100) return 2;  // Moderate
  if (usAqi <= 150) return 3;  // Unhealthy for Sensitive Groups
  if (usAqi <= 200) return 4;  // Unhealthy
  return 5; // Very Unhealthy / Hazardous
}

// Get AQI level name
function getAQILevel(usAqi: number): string {
  if (usAqi <= 50) return 'Good';
  if (usAqi <= 100) return 'Moderate';
  if (usAqi <= 150) return 'Unhealthy for Sensitive Groups';
  if (usAqi <= 200) return 'Unhealthy';
  if (usAqi <= 300) return 'Very Unhealthy';
  return 'Hazardous';
}

// Transform forecast data
function processForecastData(forecastData: any, currentWeather?: any): { today: ForecastDay; tomorrow: ForecastDay; next_days: ForecastDay[] } {
  const dailyForecasts = new Map<string, any[]>();
  
  forecastData.list.forEach((item: any) => {
    const date = new Date(item.dt * 1000).toLocaleDateString('en-CA');
    if (!dailyForecasts.has(date)) {
      dailyForecasts.set(date, []);
    }
    dailyForecasts.get(date)!.push(item);
  });

  const dates = Array.from(dailyForecasts.keys()).sort();
  const todayDate = new Date().toLocaleDateString('en-CA');
  
  const processDay = (date: string, forecasts: any[]): ForecastDay => {
    const temps = forecasts.map(f => f.main.temp);
    const tempMin = Math.min(...temps);
    const tempMax = Math.max(...temps);
    
    const middayForecast = forecasts.reduce((prev, curr) => {
      const prevHour = new Date(prev.dt * 1000).getHours();
      const currHour = new Date(curr.dt * 1000).getHours();
      return Math.abs(currHour - 12) < Math.abs(prevHour - 12) ? curr : prev;
    });

    const avgHumidity = Math.round(forecasts.reduce((sum, f) => sum + f.main.humidity, 0) / forecasts.length);
    const avgWindSpeed = forecasts.reduce((sum, f) => sum + f.wind.speed, 0) / forecasts.length;
    const maxPop = Math.round(Math.max(...forecasts.map(f => (f.pop || 0) * 100)));

    return {
      date,
      temp_min_c: Math.round(tempMin),
      temp_max_c: Math.round(tempMax),
      temp_min_f: Math.round(tempMin * (9 / 5) + 32),
      temp_max_f: Math.round(tempMax * (9 / 5) + 32),
      condition: {
        text: middayForecast.weather[0].description,
        icon: `https://openweathermap.org/img/wn/${middayForecast.weather[0].icon}@2x.png`,
      },
      humidity: avgHumidity,
      wind_kph: Math.round(avgWindSpeed * 3.6),
      wind_mph: Math.round(avgWindSpeed * 2.237),
      pop: maxPop,
    };
  };

  let today: ForecastDay | null = null;
  if (dates[0] === todayDate) {
    today = processDay(dates[0], dailyForecasts.get(dates[0])!);
  } else if (currentWeather) {
    const currentTemp = currentWeather.main?.temp || 0;
    today = {
      date: todayDate,
      temp_min_c: Math.round(currentTemp),
      temp_max_c: Math.round(currentTemp),
      temp_min_f: Math.round(currentTemp * (9 / 5) + 32),
      temp_max_f: Math.round(currentTemp * (9 / 5) + 32),
      condition: {
        text: currentWeather.weather?.[0]?.description || 'Clear',
        icon: currentWeather.weather?.[0]?.icon
          ? `https://openweathermap.org/img/wn/${currentWeather.weather[0].icon}@2x.png`
          : '',
      },
      humidity: currentWeather.main?.humidity || 0,
      wind_kph: currentWeather.wind?.speed ? Math.round(currentWeather.wind.speed * 3.6) : 0,
      wind_mph: currentWeather.wind?.speed ? Math.round(currentWeather.wind.speed * 2.237) : 0,
      pop: 0,
    };
  }

  const forecastStartIndex = dates[0] === todayDate ? 1 : 0;
  const tomorrow = dates[forecastStartIndex] ? processDay(dates[forecastStartIndex], dailyForecasts.get(dates[forecastStartIndex])!) : null;
  const nextDaysStartIndex = forecastStartIndex + 1;
  const nextDays = dates.slice(nextDaysStartIndex, nextDaysStartIndex + 3).map(date => processDay(date, dailyForecasts.get(date)!));

  return {
    today: today!,
    tomorrow: tomorrow!,
    next_days: nextDays,
  };
}

// Transform response
function transformWeatherData(
  weatherData: any,
  forecastData?: any,
  airQualityCurrent?: any
): WeatherResponse {
  return {
    location: {
      name: weatherData.name,
      region: weatherData.sys?.country,
      country: weatherData.sys?.country,
      lat: weatherData.coord?.lat,
      lon: weatherData.coord?.lon,
    },
    current: {
      temp_c: weatherData.main?.temp,
      temp_f: weatherData.main?.temp
        ? Math.round(weatherData.main.temp * (9 / 5) + 32)
        : undefined,
      feelslike_c: weatherData.main?.feels_like,
      feelslike_f: weatherData.main?.feels_like
        ? Math.round(weatherData.main.feels_like * (9 / 5) + 32)
        : undefined,
      condition: {
        text: weatherData.weather?.[0]?.description,
        icon: weatherData.weather?.[0]?.icon
          ? `https://openweathermap.org/img/wn/${weatherData.weather[0].icon}@2x.png`
          : undefined,
      },
      humidity: weatherData.main?.humidity,
      wind_kph: weatherData.wind?.speed
        ? Math.round(weatherData.wind.speed * 3.6)
        : undefined,
      wind_mph: weatherData.wind?.speed
        ? Math.round(weatherData.wind.speed * 2.237)
        : undefined,
      pressure_mb: weatherData.main?.pressure,
      vis_km: weatherData.visibility
        ? Math.round(weatherData.visibility / 1000)
        : undefined,
      vis_miles: weatherData.visibility
        ? Math.round((weatherData.visibility / 1000) * 0.621371)
        : undefined,
    },
    forecast: forecastData ? processForecastData(forecastData, weatherData) : undefined,
    air_quality: airQualityCurrent ? {
      current: airQualityCurrent,
      forecast: undefined,
    } : undefined,
  };
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const location = searchParams.get('location') || 'Hanoi, Vietnam';
  const includeForecast = searchParams.get('forecast') !== 'false';

  const WEATHER_API_KEY = process.env.WEATHER_API_KEY;
  const AIR_QUALITY_API_KEY = process.env.AIR_QUALITY_API_KEY;

  console.log('=== WEATHER & AIR QUALITY API DEBUG ===');
  console.log('Location:', location);
  console.log('Include forecast:', includeForecast);
  console.log('WEATHER_API_KEY exists:', !!WEATHER_API_KEY);
  console.log('AIR_QUALITY_API_KEY exists:', !!AIR_QUALITY_API_KEY);
  console.log('=======================================');

  if (!WEATHER_API_KEY) {
    return NextResponse.json(
      { error: 'WEATHER_API_KEY không được cấu hình' },
      { status: 500 }
    );
  }

  // Check cache
  const cacheKey = `${location.toLowerCase().trim()}_${includeForecast}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    console.log('✅ Returning cached data');
    return NextResponse.json(cached.data);
  }

  try {
    // 1. Fetch weather data from OpenWeatherMap (vẫn dùng tên thành phố)
    console.log('🌤️ Fetching weather from OpenWeatherMap...');
    const weatherUrl = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(location)}&appid=${WEATHER_API_KEY}&units=metric&lang=vi`;
    const weatherResponse = await fetch(weatherUrl);

    if (!weatherResponse.ok) {
      const errorText = await weatherResponse.text();
      console.error('❌ Weather API error:', weatherResponse.status, errorText);
      return NextResponse.json(
        { error: `Weather API error: ${weatherResponse.status}` },
        { status: weatherResponse.status }
      );
    }

    const weatherData = await weatherResponse.json();
    console.log('✅ Weather data fetched');
    console.log('📍 Coordinates:', weatherData.coord);

    // 2. Fetch weather forecast from OpenWeatherMap (vẫn dùng tên thành phố)
    let forecastData = null;
    if (includeForecast) {
      try {
        console.log('🌤️ Fetching weather forecast...');
        const forecastUrl = `https://api.openweathermap.org/data/2.5/forecast?q=${encodeURIComponent(location)}&appid=${WEATHER_API_KEY}&units=metric&lang=vi`;
        const forecastResponse = await fetch(forecastUrl);
        
        if (forecastResponse.ok) {
          forecastData = await forecastResponse.json();
          console.log('✅ Weather forecast fetched');
        }
      } catch (error) {
        console.warn('⚠️ Weather forecast fetch failed:', error);
      }
    }

    // 3. Fetch air quality from IQAir using coordinates (THAY ĐỔI Ở ĐÂY)
    let airQualityCurrent = null;

    if (AIR_QUALITY_API_KEY && weatherData.coord) {
      const { lat, lon } = weatherData.coord;
      
      try {
        console.log(`🌫️ Fetching air quality from IQAir (lat: ${lat}, lon: ${lon})...`);
        
        // Sử dụng nearest_city endpoint với tọa độ
        const aqUrl = `https://api.airvisual.com/v2/nearest_city?lat=${lat}&lon=${lon}&key=${AIR_QUALITY_API_KEY}`;
        const aqResponse = await fetch(aqUrl);

        if (aqResponse.ok) {
          const aqData = await aqResponse.json();
          console.log('📊 IQAir response status:', aqData.status);
          
          if (aqData.status === 'success' && aqData.data?.current?.pollution) {
            const pollution = aqData.data.current.pollution;
            const aqius = pollution.aqius || 50;
            
            airQualityCurrent = {
              aqi: convertUSAQIToScale(aqius),
              aqi_us: aqius,
              main_pollutant: pollution.mainus || 'pm2.5',
              level: getAQILevel(aqius),
              components: {
                pm2_5: pollution.p2,
                pm10: pollution.p1,
                o3: pollution.o3,
                no2: pollution.n2,
                so2: pollution.s2,
                co: pollution.co,
              },
            };
            
            console.log(`✅ Current air quality: AQI ${aqius} (${getAQILevel(aqius)})`);
            console.log(`📍 Nearest station: ${aqData.data?.city || 'Unknown'}`);
          } else {
            console.warn('⚠️ Unexpected IQAir response structure:', JSON.stringify(aqData, null, 2));
          }
        } else {
          const errorText = await aqResponse.text();
          console.warn('⚠️ IQAir API error:', aqResponse.status, errorText);
        }
      } catch (error) {
        console.warn('⚠️ Failed to fetch air quality from IQAir:', error);
      }
    } else {
      if (!AIR_QUALITY_API_KEY) {
        console.warn('⚠️ AIR_QUALITY_API_KEY not configured');
      }
      if (!weatherData.coord) {
        console.warn('⚠️ No coordinates available from weather data');
      }
    }

    // Transform and return data
    const transformedData = transformWeatherData(
      weatherData,
      forecastData,
      airQualityCurrent
    );

    // Cache the response
    cache.set(cacheKey, {
      data: transformedData,
      timestamp: Date.now(),
    });
    console.log('💾 Data cached');

    cleanCache();

    return NextResponse.json(transformedData);
  } catch (error: any) {
    console.error('❌ API error:', error);
    return NextResponse.json(
      {
        error: error.message || 'Không thể lấy dữ liệu',
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}

function cleanCache() {
  const now = Date.now();
  for (const [key, value] of cache.entries()) {
    if (now - value.timestamp > CACHE_DURATION) {
      cache.delete(key);
    }
  }
  if (cache.size > 10) {
    const entries = Array.from(cache.entries()).sort(
      (a, b) => a[1].timestamp - b[1].timestamp
    );
    const toDelete = entries.slice(0, entries.length - 10);
    toDelete.forEach(([key]) => cache.delete(key));
  }
}