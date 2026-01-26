import { NextRequest, NextResponse } from 'next/server';
import { fetchWeatherAndAirQuality } from '../../lib/weatherService';

// Simple in-memory cache
const cache = new Map<string, { data: any; timestamp: number }>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const location = searchParams.get('location') || 'Hanoi, Vietnam';
  const includeForecast = searchParams.get('forecast') !== 'false';

  // Check cache
  const cacheKey = `${location.toLowerCase().trim()}_${includeForecast}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return NextResponse.json(cached.data);
  }

  try {
    const data = await fetchWeatherAndAirQuality(location, includeForecast);

    // Cache the response
    cache.set(cacheKey, {
      data,
      timestamp: Date.now(),
    });
    
    // Clean old cache
    const now = Date.now();
    for (const [key, value] of cache.entries()) {
      if (now - value.timestamp > CACHE_DURATION) {
        cache.delete(key);
      }
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('API error:', error);
    return NextResponse.json(
      {
        error: error.message || 'Unable to fetch data',
      },
      { status: 500 }
    );
  }
}