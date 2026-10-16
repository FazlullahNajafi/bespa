import { useQuery } from '@tanstack/react-query';

import type { IconName } from '@/components/icon';
import { supabase } from '@/lib/supabase';
import { keys } from './keys';

/**
 * Weather for the user's own village (spec 03.1).
 *
 * Open-Meteo, called straight from the app. It needs no API key, which is why spec 07's
 * server-side proxy is not used: a proxy exists to keep a key secret, and there is no key
 * to keep. That also sidesteps edge functions, which are disabled on this project.
 *
 * Spec 03.1 is strict about failure: the section is **hidden entirely, never an error**.
 * Weather is the only third-party runtime dependency in the Village module, and a village
 * screen that shows a red banner because a forecast server is down has made someone
 * else's outage into the user's problem. So every failure path here resolves to "no data"
 * and the card simply does not render.
 */

const ENDPOINT = 'https://api.open-meteo.com/v1/forecast';

export type WeatherPoint = {
  lat: number;
  lon: number;
  /** The place the reading is actually for — the block when `exact` is false. */
  place: string;
  exact: boolean;
};

/**
 * Where to ask about. Resolved server-side by `my_weather_point`, which falls back to the
 * block when a village has no coordinate of its own — most do not, because geocoders
 * cover small Ladakhi hamlets poorly.
 *
 * Returns null rather than throwing when the user has no village or no coordinate can be
 * found: the card is built to be absent.
 */
export function useMyWeatherPoint(enabled: boolean) {
  return useQuery({
    queryKey: keys.weather.point(),
    enabled,
    staleTime: 1000 * 60 * 60 * 24,
    queryFn: async (): Promise<WeatherPoint | null> => {
      const { data, error } = await supabase.rpc('my_weather_point');
      if (error) return null;
      const row = (data as WeatherPoint[] | null)?.[0];
      return row ?? null;
    },
  });
}

export type WeatherDay = {
  /** ISO date, e.g. 2026-10-16. */
  date: string;
  code: number;
  maxC: number;
  minC: number;
};

export type Weather = {
  nowC: number;
  feelsLikeC: number;
  code: number;
  /** Today first, then the next two (spec 03.1's three-day strip). */
  days: WeatherDay[];
};

/**
 * WMO weather codes grouped to the four glyphs we carry. Deliberately coarse: a villager
 * deciding whether the road is passable needs clear/cloud/rain/snow, not "light drizzle,
 * dense intensity".
 */
export function conditionOf(code: number): { icon: IconName; labelKey: string } {
  if (code <= 1) return { icon: 'sun', labelKey: 'weather.clear' };
  if (code <= 3) return { icon: 'cloud', labelKey: 'weather.cloudy' };
  if (code <= 48) return { icon: 'cloud', labelKey: 'weather.fog' };
  if (code <= 67) return { icon: 'rain', labelKey: 'weather.rain' };
  if (code <= 77) return { icon: 'snow', labelKey: 'weather.snow' };
  if (code <= 82) return { icon: 'rain', labelKey: 'weather.showers' };
  if (code <= 86) return { icon: 'snow', labelKey: 'weather.snow' };
  return { icon: 'rain', labelKey: 'weather.storm' };
}

type Coords = { lat: number; lon: number } | null | undefined;

export function useWeather(coords: Coords) {
  return useQuery({
    queryKey: keys.weather.at(coords?.lat ?? null, coords?.lon ?? null),
    enabled: Boolean(coords),
    // Spec 07 allows a 30-minute cache. Mountain weather turns faster than that is
    // comfortable, but refetching more often buys nothing on a 2G connection.
    staleTime: 1000 * 60 * 30,
    retry: 1,
    // Never restored from disk. gcTime is a week, and a week-old temperature presented as
    // current is worse than no temperature — the card is built to be absent.
    meta: { persist: false },
    queryFn: async (): Promise<Weather | null> => {
      const { lat, lon } = coords!;
      const url =
        `${ENDPOINT}?latitude=${lat}&longitude=${lon}` +
        '&current=temperature_2m,apparent_temperature,weather_code' +
        '&daily=weather_code,temperature_2m_max,temperature_2m_min' +
        '&forecast_days=3&timezone=auto';

      // A 10s ceiling: past that the card is better off absent than holding the screen.
      const abort = new AbortController();
      const timer = setTimeout(() => abort.abort(), 10_000);
      try {
        const res = await fetch(url, { signal: abort.signal });
        if (!res.ok) return null;
        const raw = (await res.json()) as OpenMeteoResponse;
        return parse(raw);
      } catch {
        // Swallowed on purpose — see the note above about hiding rather than erroring.
        return null;
      } finally {
        clearTimeout(timer);
      }
    },
  });
}

type OpenMeteoResponse = {
  current?: {
    temperature_2m?: number;
    apparent_temperature?: number;
    weather_code?: number;
  };
  daily?: {
    time?: string[];
    weather_code?: number[];
    temperature_2m_max?: number[];
    temperature_2m_min?: number[];
  };
};

function parse(raw: OpenMeteoResponse): Weather | null {
  const now = raw.current;
  if (!now || typeof now.temperature_2m !== 'number') return null;

  const d = raw.daily;
  const days: WeatherDay[] = [];
  if (d?.time && d.weather_code && d.temperature_2m_max && d.temperature_2m_min) {
    for (let i = 0; i < d.time.length; i += 1) {
      const [date, code, maxC, minC] = [
        d.time[i],
        d.weather_code[i],
        d.temperature_2m_max[i],
        d.temperature_2m_min[i],
      ];
      // One malformed entry drops that day rather than the whole forecast.
      if (date && typeof code === 'number' && typeof maxC === 'number' && typeof minC === 'number') {
        days.push({ date, code, maxC, minC });
      }
    }
  }

  return {
    nowC: Math.round(now.temperature_2m),
    feelsLikeC: Math.round(now.apparent_temperature ?? now.temperature_2m),
    code: now.weather_code ?? 0,
    days,
  };
}
