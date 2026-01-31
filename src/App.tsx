import React, { useMemo, useState, useCallback, useEffect } from 'react';
import { Settings, ChevronLeft, ChevronRight, User } from 'lucide-react';
import { getMoonData, getMoonPosition } from './utils/moon';
import { MoonPhaseRow } from './components/charts/MoonPhaseRow';
import { getSunPosition } from './utils/sun';
import { useAuth } from './contexts/AuthContext';
import SunCalc from 'suncalc';
import type { TideEvent } from './types/weather';
import { currentConfig } from './config/appConfig';

import { TimelineContainer, type TimelineHandle } from './components/layout/TimelineContainer';
import { decodeShareData } from './utils/sharing';

import { TimeAxis } from './components/layout/TimeAxis';
import { WeatherPanel } from './components/panels/WeatherPanel';
import { TemperatureChart } from './components/charts/TemperatureChart';
import { WindChart } from './components/charts/WindChart';
import { PrecipitationChart } from './components/charts/PrecipitationChart';
import { SkyCoverChart } from './components/charts/SkyCoverChart';
import { TideChart } from './components/charts/TideChart';
import { MarineChart } from './components/charts/MarineChart';
import { WaterTempChart } from './components/charts/WaterTempChart';
import { StickyAxis } from './components/charts/StickyAxis';
import { AQIChart } from './components/charts/AQIChart';
import { UVChart } from './components/charts/UVChart';
import { SettingsDialog } from './components/SettingsDialog';
import type { AppSettings } from './types/settings';
import { DEFAULT_SETTINGS } from './types/settings';
import type { WeatherPoint } from './types/weather';
import { fetchWeatherData } from './services/api';
import type { LocationResult } from './services/api';
import { LocationSearch } from './components/LocationSearch';
import { StatusIndicator } from './components/StatusIndicator';
import { ActivityBuilder } from './components/activities/ActivityBuilder';
import { ShareButton } from './components/ShareButton';
import { serializeSettings, parseSettings, serializeLocation, parseLocation } from './utils/url';
import './App.css';

// Configuration
import { ActivityManager } from './components/activities/ActivityManager';
import { ActivityRow } from './components/charts/ActivityRow';
import { activityStore } from './services/activityStore';
import { settingsStore } from './services/settingsStore';
import type { Activity } from './types/activity';
import { GoogleCalendarService } from './services/calendar/googleCalendar';
import { generateCalendarBlocks } from './utils/scheduler';
import { calculateActivityScore } from './services/scorer';
import { PrivacyPolicy } from './components/PrivacyPolicy';
import { TermsOfService } from './components/TermsOfService';

const HOURS = 240; // 10 days
const DEFAULT_HOUR_WIDTH = 10; // px - Condensed for mobile
const START_OFFSET = 120; // 5 days back

function App() {
  // Simple Routing
  if (window.location.pathname === '/privacy') {
    return <PrivacyPolicy />;
  }
  if (window.location.pathname === '/terms') {
    return <TermsOfService />;
  }

  // Scale state for pinch-to-zoom
  const [hourWidth, setHourWidth] = useState(DEFAULT_HOUR_WIDTH);

  // UI State for Activity Manager
  const [isManagerOpen, setIsManagerOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingSync, setPendingSync] = useState(false); // Track if user wanted to sync but needed login

  // Data & State
  // Default Location: New York (or load from URL, then storage)
  const [currentLocation, setCurrentLocation] = useState<LocationResult>(() => {
    // 1. Try URL
    const params = new URLSearchParams(window.location.search);
    const urlLoc = parseLocation(params);
    if (urlLoc) return urlLoc;

    // 2. Try Storage
    try {
      const saved = localStorage.getItem('weather_location');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error('Failed to load location', e);
    }
    // 3. Default
    return {
      id: 5128581,
      name: "New York",
      latitude: 40.71427,
      longitude: -74.00597,
      elevation: 10,
      country_code: "US",
      admin1: "NY",
      timezone: "America/New_York"
    };
  });

  const [weatherData, setWeatherData] = useState<WeatherPoint[]>([]);
  const [tideStation, setTideStation] = useState<{ name: string; distance: number; alertThreshold?: number } | null>(null);
  const [tideHighLows, setTideHighLows] = useState<TideEvent[]>([]); // Added
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { user, signInWithGoogle, logout, isPremium, googleToken } = useAuth();
  const [lastFetchTime, setLastFetchTime] = useState<Date | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Load activities based on Auth state
  useEffect(() => {
    const loadActivities = async () => {
      let data = await activityStore.getAll(user?.uid);

      // Auto-Migration: If logged in, but cloud is empty, try migrating local
      if (user?.uid && data.length === 0) {
        await activityStore.migrateLocalToCloud(user.uid);
        data = await activityStore.getAll(user.uid); // Fetch again
      }

      // If fetched from cloud, they might need sorting by 'sortOrder' if we implemented that.
      // For now, let's just use them as returned (which might be random order).
      // To fix order, we should sort by sortOrder on fetch.
      const sorted = user ? data.sort((a: any, b: any) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)) : data;
      setActivities(sorted);
      setActivitiesLoaded(true);
    };
    loadActivities();
  }, [user]);

  // Initial Load (already handled by useEffect above, so we can init empty)
  const [activities, setActivities] = useState<Activity[]>([]);
  const [activitiesLoaded, setActivitiesLoaded] = useState(false); // Track loading state
  const [editingActivity, setEditingActivity] = useState<Activity | undefined>(undefined);

  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);

  // Load Settings on Auth Change
  useEffect(() => {
    const loadSettings = async () => {
      // Just like activities, try migrate if logging in
      if (user?.uid) {
        await settingsStore.migrateLocalToCloud(user.uid);
      }
      const saved = await settingsStore.get(user?.uid);

      // Merge with URL params if present (URL takes precedence for sharing)
      const params = new URLSearchParams(window.location.search);
      if (params.has('u') || params.has('charts')) {
        const urlSettings = parseSettings(params);
        setSettings({ ...saved, ...urlSettings });
      } else {
        setSettings(saved);
      }
    };
    loadSettings();
  }, [user]);

  // Wrapper to save settings
  const updateSettings = (val: AppSettings | ((prev: AppSettings) => AppSettings)) => {
    setSettings(prev => {
      const next = typeof val === 'function' ? val(prev) : val;
      settingsStore.save(next, user?.uid);
      return next;
    });
  };

  // Calendar Sync
  const handleSync = async () => {
    if (!googleToken) {
      try {
        setPendingSync(true); // Mark intent
        await signInWithGoogle();
        return;
      } catch (e) {
        setPendingSync(false);
        alert('Sign in failed to authorize calendar access.');
        return;
      }
    }

    setIsSyncing(true);
    try {
      const service = new GoogleCalendarService(googleToken);
      const calendarId = await service.ensureCalendar();

      // Time Range: Now to 10 days out
      const start = new Date();
      const end = new Date();
      end.setDate(end.getDate() + 10);

      // 1. Clear Existing Events in range
      const existingEvents = await service.getEvents(calendarId, start, end);
      await Promise.all(existingEvents.map(e => service.deleteEvent(calendarId, e.id)));

      // 2. Add New Ideal Blocks
      let totalEvents = 0;
      for (const activity of activities) { // activityStore.getAll result
        const scores = weatherData.map(pt =>
          calculateActivityScore(activity, pt, currentLocation.latitude, currentLocation.longitude)
        );

        const blocks = generateCalendarBlocks(
          activity,
          weatherData,
          scores,
          currentLocation.latitude,
          currentLocation.longitude,
          currentLocation.name
        );

        // Determine specific location name for the *Invite*
        // Implementation Note: generateCalendarBlocks uses the coordinates for sun/moon,
        // but the *Invite Location* should match what the user sees.
        const eventLocation = activity.location ? activity.location.name : currentLocation.name;

        for (const block of blocks) {
          await service.createEvent(calendarId, {
            summary: block.summary,
            description: block.htmlDescription, // Use HTML for clickable links
            location: eventLocation, // Pass location name
            start: block.start,
            end: block.end
          });
          totalEvents++;
        }
      }

      if (totalEvents === 0) {
        alert('Sync Complete: No "Ideal" times found in the next 10 days for your activities.');
      } else {
        alert(`Sync Complete: Successfully added ${totalEvents} events to "The Ideal Time" calendar.`);
      }
    } catch (e: any) {
      console.error("Sync Error", e);
      alert(`Sync Failed: ${e.message}`);
    } finally {
      setIsSyncing(false);
    }
  };

  // Auto-Sync after Login
  useEffect(() => {
    if (googleToken && pendingSync) {
      setPendingSync(false);
      handleSync();
    }
  }, [googleToken, pendingSync]);

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isActivityBuilderOpen, setIsActivityBuilderOpen] = useState(false);
  const timelineRef = React.useRef<TimelineHandle>(null);

  // URL Synchronization
  useEffect(() => {
    // Initialize with current params to preserve 'share', 'import_*', etc.
    const params = new URLSearchParams(window.location.search);

    // Update/Overwrite Loc Params
    const locParams = serializeLocation(currentLocation);
    locParams.forEach((v, k) => params.set(k, v));

    // Update/Overwrite Settings Params
    const setParams = serializeSettings(settings);
    setParams.forEach((v, k) => params.set(k, v));

    const newUrl = `${window.location.pathname}?${params.toString()}`;

    // Update URL without reload
    window.history.replaceState({}, '', newUrl);

  }, [currentLocation, settings]);

  // Update Page Title
  useEffect(() => {
    document.title = `${currentLocation.name} | Weather Plot`;
  }, [currentLocation.name]);

  // Fetch Data


  const loadData = useCallback(async (forceRefresh = false) => {
    setLoading(true);
    setError(null);
    try {
      const { points, tideStation, tideHighLows, fetchedAt } = await fetchWeatherData(
        currentLocation.latitude,
        currentLocation.longitude,
        forceRefresh
      );
      setWeatherData(points);
      setTideStation(tideStation);
      setTideHighLows(tideHighLows || []);
      // If we forced a refresh, fetchedAt should be new.
      setLastFetchTime(fetchedAt ? new Date(fetchedAt) : new Date());
    } catch (err) {
      console.error(err);
      setError("Failed to load weather data");
    } finally {
      setLoading(false);
    }
  }, [currentLocation]);

  // Initial Fetch & Location Change
  useEffect(() => {
    loadData();
  }, [loadData]);

  // Clock for "Now" line - Updates every minute
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  // Auto-Refresh Data if stale per user request (> 60 mins age)
  useEffect(() => {
    if (!lastFetchTime) return;
    const interval = setInterval(() => {
      const diffMinutes = (new Date().getTime() - lastFetchTime.getTime()) / (1000 * 60);
      if (diffMinutes >= 60) {
        if (import.meta.env.DEV) console.log('Auto-refreshing weather data...');
        loadData();
      }
    }, 60000); // Check every minute
    return () => clearInterval(interval);
  }, [lastFetchTime, loadData]);

  // Persistence Effects
  useEffect(() => {
    localStorage.setItem('weather_location', JSON.stringify(currentLocation));
  }, [currentLocation]);

  useEffect(() => {
    localStorage.setItem('weather_settings', JSON.stringify(settings));
  }, [settings]);

  // Global Tooltip State
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const totalWidth = weatherData.length * hourWidth;
  const commonHeight = 120; // Reduced from 160
  const syncId = "weather-timeline";

  // Zoom handler
  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = e.deltaY * -0.01;
      setHourWidth(prev => Math.max(5, Math.min(60, prev + delta)));
    }
  }, []);

  const handleTimeSelect = useCallback((index: number) => {
    setSelectedIndex(prev => prev === index ? null : index);
  }, []);



  // 1. Process Data based on Units (Metric vs Imperial)
  const processedData = useMemo(() => {
    const isMetric = settings.units === 'metric';
    return weatherData.map(d => {
      let temp = d.temperature;
      let feels = d.feelsLike;
      let dew = d.dewPoint;
      let speed = d.windSpeed;
      let gust = d.windGust;
      let precip = d.precipitationAmount;
      let tide = d.tideHeight;
      let wave = d.waveHeight;
      let swell = d.swellHeight;
      let waterTemp = d.waterTemperature;

      if (isMetric) {
        // F -> C
        temp = (temp - 32) * 5 / 9;
        feels = (feels - 32) * 5 / 9;
        dew = (dew - 32) * 5 / 9;
        // mph -> m/s
        speed = speed * 0.44704;
        if (gust) gust = gust * 0.44704;
        // mm -> mm (No change)

        // Tide: Base is Feet (from NOAA 'english'). Convert to Meters.
        if (tide !== null) tide = tide * 0.3048;

        // Wave/Swell: Base is Meters (from OpenMeteo). No change.
      } else {
        // Imperial
        // F -> F
        // mph -> mph
        // mm -> in
        precip = precip / 25.4;

        // Tide: Base is Feet. No change.

        // Marine: Base is Meters. Convert to Feet.
        if (wave !== null) wave = wave * 3.28084;
        if (swell !== null) swell = swell * 3.28084;
        if (waterTemp !== null) waterTemp = (waterTemp * 9 / 5) + 32;
      }

      // Calculate Visual Intensity (NWS Standards) based on Inches
      // Rain: Light < 0.1", Moderate 0.1-0.3", Heavy > 0.3"
      // Snow: Light < 0.5", Moderate 0.5-1.0", Heavy > 1.0" (Roughly 10:1 but condensed for visual)
      const precipInches = isMetric ? precip / 25.4 : precip;
      let precipIntensity = 0;
      if (precipInches > 0) {
        if (d.precipitationType === 'snow') {
          if (precipInches < 0.5) precipIntensity = 0.25;
          else if (precipInches < 1.0) precipIntensity = 0.50;
          else precipIntensity = 0.75;
        } else {
          if (precipInches < 0.10) precipIntensity = 0.25;
          else if (precipInches < 0.30) precipIntensity = 0.50;
          else precipIntensity = 0.75;
        }
      }

      // Filter Gusts: Only show if > 10 mph (4.5 m/s) over sustained wind
      const gustThreshold = isMetric ? 4.5 : 10;
      if (gust && (gust - speed) < gustThreshold) {
        gust = undefined;
      }

      return {
        ...d,
        temperature: temp,
        feelsLike: feels,
        dewPoint: dew,
        windSpeed: speed,
        windGust: gust,
        precipitationAmount: precip,
        precipIntensity,
        tideHeight: tide,
        waveHeight: wave,
        swellHeight: swell,
        waterTemperature: waterTemp
      };
    });
    // Add settings.units dependency to ensure re-calculation
  }, [weatherData, settings.units]);

  // 2. Derive Domains from Processed Data
  // 2. Derive Domains & Ticks (Unified to ensure snapping)
  // Temperature
  const { tempDomain, tempTicks } = useMemo(() => {
    const temps = processedData.map(d => d.temperature);
    const feels = settings.temp.showFeelsLike ? processedData.map(d => d.feelsLike) : [];

    let minVal = Math.min(...temps, ...feels);
    let maxVal = Math.max(...temps, ...feels);

    // Default fallback if no data
    if (!isFinite(minVal) || !isFinite(maxVal)) {
      minVal = 0;
      maxVal = 10;
    }

    // Determine target range with some visual padding
    // We want approximately 5 ticks.
    // Range = Max - Min. 
    // Rough Step = Range / 4.
    const rawRange = maxVal - minVal;
    // Ensure minimum range to avoid divide by zero or single tick
    const minRange = settings.units === 'metric' ? 5 : 10;
    const range = Math.max(rawRange, minRange);

    // Calculate rough step
    const targetTicks = 5;
    const roughStep = range / (targetTicks - 1);

    // Snap step to nice numbers: 1, 2, 5, 10, 20
    const possibleSteps = settings.units === 'metric'
      ? [1, 2, 5, 10, 20]
      : [2, 5, 10, 20, 50];

    const step = possibleSteps.find(s => s >= roughStep) || possibleSteps[possibleSteps.length - 1];

    // Calculate Domain Snapped to Step
    // We add one step of "padding" to the raw min/max before snapping to ensure the data doesn't touch the edge
    const snapMin = Math.floor((minVal - (step * 0.5)) / step) * step;
    const snapMax = Math.ceil((maxVal + (step * 0.5)) / step) * step; // Ensure we go ABOVE the max

    const ticks = [];
    for (let i = snapMin; i <= snapMax; i += step) {
      ticks.push(i);
    }

    return {
      tempDomain: [snapMin, snapMax] as [number, number],
      tempTicks: ticks
    };
  }, [processedData, settings.temp.showFeelsLike, settings.units]);

  const { windDomain, windTicks } = useMemo(() => {
    const speeds = processedData.map(d => Math.max(d.windSpeed, d.windGust || 0));
    const maxVal = Math.max(...speeds, 0);

    // Determine target range
    const minRange = settings.units === 'metric' ? 5 : 10;
    const range = Math.max(maxVal, minRange);

    // Calculate rough step
    const targetTicks = 5;
    const roughStep = range / (targetTicks - 1);

    // Snap step to nice numbers
    const possibleSteps = settings.units === 'metric'
      ? [1, 2, 5, 10, 20]
      : [2, 5, 10, 20, 50];

    const step = possibleSteps.find(s => s >= roughStep) || possibleSteps[possibleSteps.length - 1];

    // Calculate Domain Snapped to Step
    // Add small buffer so max value doesn't sit exactly on the top line if possible
    const snapMax = Math.ceil((maxVal + (step * 0.25)) / step) * step;

    const ticks = [];
    for (let i = 0; i <= snapMax; i += step) {
      ticks.push(i);
    }

    return {
      windDomain: [0, snapMax] as [number, number],
      windTicks: ticks
    };
  }, [processedData, settings.units]);

  const tideDomain = useMemo(() => {
    const values = processedData.map(d => d.tideHeight ?? 0);
    if (values.length === 0) return [0, 1] as [number, number];

    const minVal = Math.min(...values);
    const maxVal = Math.max(...values);
    // Increased buffer to prevent text clipping (especially for High/Low markers)
    const buffer = settings.units === 'metric' ? 1.0 : 4;

    return [Math.floor(minVal - buffer), Math.ceil(maxVal + buffer)] as [number, number];
  }, [processedData, settings.units]);

  // General Tick Helper
  const getLinearTicks = (min: number, max: number, step: number) => {
    const ticks = [];
    const start = Math.ceil(min / step) * step;
    for (let i = start; i <= max; i += step) {
      ticks.push(i);
    }
    return ticks;
  };


  const precipTicks = [0, 0.25, 0.5, 0.75, 1];
  const tideTicks = useMemo(() => {
    const range = tideDomain[1] - tideDomain[0];
    // Dynamic step calculation to target ~4-5 ticks for the small 90px height
    // If range is large (e.g. 18ft), step should be ~4 or 5.
    // If range is small (e.g. 3m), step should be ~0.5 or 1.

    let targetTickCount = 5;
    let roughStep = range / targetTickCount;

    // Normalize roughStep to nice values (1, 2, 5, 10, or 0.5, 0.25)
    let step = 1;
    if (settings.units === 'metric') {
      if (roughStep > 1.5) step = 2;
      else if (roughStep > 0.8) step = 1;
      else step = 0.5;
    } else {
      if (roughStep > 8) step = 10;
      else if (roughStep > 4) step = 5;
      else if (roughStep > 2) step = 2; // e.g. 18 / 5 = 3.6 -> 2 (might be too dense? 18/2=9 ticks. Too many)
      // Wait, if 18ft range. Step 2 => 9 ticks. Too crowded for 90px.
      // If rough step is 3.6, we should probably go to 5.
      // Let's be deeper:
      else step = 2;

      if (roughStep > 3.5) step = 5; // Preference for 5 over 4
    }

    // Ensure we don't have too many
    if (range / step > 7) {
      step = step * 2; // Force reduce density
    }

    return getLinearTicks(tideDomain[0], tideDomain[1], step);
  }, [tideDomain, settings.units]);

  // Calculate "Now" position
  const nowIndex = useMemo(() => {
    if (processedData.length === 0) return START_OFFSET;

    // Find the fractional index corresponding to "now"
    const now = currentTime; // Use dynamic currentTime state
    const startTime = processedData[0].timestamp; // Local time object
    const diffHours = (now.getTime() - startTime.getTime()) / (1000 * 60 * 60);

    // Clamp to valid range
    const index = Math.max(0, Math.min(processedData.length - 1, diffHours));
    return Math.round(index); // Round to match integer index for Recharts
  }, [processedData, currentTime]);

  // 4. Labels & Tooltip
  const unitLabels = {
    temp: settings.units === 'metric' ? '°C' : '°F',
    wind: settings.units === 'metric' ? 'm/s' : 'mph',
    precip: settings.units === 'metric' ? 'mm' : 'in',
    tide: settings.units === 'metric' ? 'm' : 'ft',
  };

  const selectedData = selectedIndex !== null ? processedData[selectedIndex] : null;

  const tooltipLeft = selectedIndex !== null ? (selectedIndex * hourWidth) + (hourWidth / 2) : undefined;

  const getCardinalDirection = (angle: number) => {
    const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    return directions[Math.round(angle / 45) % 8];
  };

  const getTooltipContent = (type: string, data: any) => {
    if (!data) return null;
    const boxStyle = {
      backgroundColor: 'rgba(0,0,0,0.8)', padding: '5px 10px', borderRadius: '4px',
      border: '1px solid #444', fontSize: '12px', whiteSpace: 'nowrap' as const
    };

    switch (type) {
      case 'temp':
        return (
          <div style={boxStyle}>
            <p style={{ color: '#fff', margin: 0 }}>{Math.round(data.temperature)}{unitLabels.temp}</p>
            {settings.temp.showFeelsLike && (
              <p style={{ color: '#aaa', margin: 0 }}>Feels: {Math.round(data.feelsLike)}{unitLabels.temp}</p>
            )}
            {settings.temp.showDewPoint && (
              <p style={{ color: '#4db6ac', margin: 0 }}>Dew: {Math.round(data.dewPoint)}{unitLabels.temp}</p>
            )}
            <p style={{ color: '#ccc', margin: 0, fontSize: '10px' }}>{data.condition}</p>
          </div>
        );
      case 'aqi':
        let aqiLabel = 'Good';
        if (data.aqi > 50) aqiLabel = 'Moderate';
        if (data.aqi > 100) aqiLabel = 'Unhealthy';
        if (data.aqi > 150) aqiLabel = 'Unhealthy+';
        return <div style={boxStyle}><p style={{ color: '#fff', margin: 0 }}>AQI: {data.aqi} ({aqiLabel})</p></div>;
      case 'uv':
        let uvLabel = 'Low';
        if (data.uvIndex >= 3) uvLabel = 'Moderate';
        if (data.uvIndex >= 6) uvLabel = 'High';
        if (data.uvIndex >= 8) uvLabel = 'Very High';
        if (data.uvIndex >= 11) uvLabel = 'Extreme';
        return <div style={boxStyle}><p style={{ color: '#fff', margin: 0 }}>UV Index: {data.uvIndex.toFixed(1)} ({uvLabel})</p></div>;
      case 'wind':
        return (
          <div style={boxStyle}>
            <p style={{ color: '#fff', margin: 0 }}>{Math.round(data.windSpeed)} {unitLabels.wind}</p>
            <p style={{ color: '#ccc', margin: 0, fontSize: '10px' }}>{getCardinalDirection(data.windDirection)}</p>
            {data.windGust && (
              <>
                <div style={{ height: '1px', backgroundColor: '#444', margin: '4px 0' }} />
                <p style={{ color: '#f97316', margin: 0 }}>Gust: {Math.round(data.windGust)} {unitLabels.wind}</p>
                <p style={{ color: '#f97316', margin: 0, fontSize: '10px' }}>{getCardinalDirection(data.windGustDirection!)}</p>
              </>
            )}
          </div>
        );
      case 'precip':
        const typeLabel = data.precipitationType.charAt(0).toUpperCase() + data.precipitationType.slice(1);
        return (
          <div style={boxStyle}>
            <p style={{ color: '#fff', margin: 0, fontWeight: 'bold' }}>{typeLabel}</p>
            {settings.precip.showHumidity && <p style={{ color: '#ccc', margin: 0 }}>Humidity: {Math.round(data.humidity * 100)}%</p>}
            <p style={{ color: '#ab47bc', margin: 0 }}>Prob: {Math.round(data.precipitationProbability * 100)}%</p>
            {settings.precip.showAmount && <p style={{ color: '#29b6f6', margin: 0 }}>Amt: {data.precipitationAmount.toFixed(2)}{unitLabels.precip}</p>}
            {settings.precip.showThunder && data.thunderProbability > 0 && (
              <p style={{ color: '#d32f2f', margin: 0, marginTop: '2px' }}>⚡ {Math.round(data.thunderProbability * 100)}%</p>
            )}
          </div>
        );
      case 'sky':
        return <div style={boxStyle}><p style={{ color: '#aecbfa', margin: 0 }}>Cover: {Math.round(data.cloudCover * 100)}%</p></div>;
      case 'tide':
        if (data.tideHeight === null || data.tideHeight === undefined) return null;

        // Find High/Low events near this timestamp (within 45 mins)
        let tideEventLabel: string | null = null;
        let tideEventHeight: string | null = null;

        // Filter events that match the day/hour approximation
        // Actually, we can check proximity directly.
        // We only want to show the event if the selected hour is the closest hour to the event.
        const nearbyTide = tideHighLows.find(e => Math.abs(e.timestamp.getTime() - data.timestamp.getTime()) < 45 * 60 * 1000);

        if (nearbyTide) {
          const timeStr = nearbyTide.timestamp.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
          const typeStr = nearbyTide.type === 'high' ? 'High Tide' : 'Low Tide';
          tideEventLabel = `${typeStr} at ${timeStr}`;

          // Format Height based on units
          let h = nearbyTide.height;
          // Base is Feet.
          if (settings.units === 'imperial') {
            tideEventHeight = `${h.toFixed(1)}ft`;
          } else {
            // Convert to Meters
            h = h * 0.3048;
            tideEventHeight = `${h.toFixed(2)}m`;
          }
        }

        return (
          <div style={boxStyle}>
            {tideEventLabel ? (
              <>
                <p style={{ color: '#fff', margin: 0, fontWeight: 'bold' }}>{tideEventLabel}</p>
                <p style={{ color: '#aaa', margin: 0 }}>Height: {tideEventHeight}</p>
              </>
            ) : (
              <p style={{ color: '#fff', margin: 0 }}>Tide: {data.tideHeight.toFixed(2)}{unitLabels.tide}</p>
            )}
          </div>
        );

      case 'moon':
        const moon = getMoonData(data.timestamp);
        const moonPos = getMoonPosition(data.timestamp, currentLocation.latitude, currentLocation.longitude);

        // Check for Moon Rise/Set within 45 mins (since data is hourly, +/- 30 might miss if event is at :31)
        // Actually, typically we associate the event with the closes hour.
        const mTimes = SunCalc.getMoonTimes(data.timestamp, currentLocation.latitude, currentLocation.longitude);
        let moonEventLabel: string | null = null;

        if (mTimes.rise) {
          const diff = Math.abs(data.timestamp.getTime() - mTimes.rise.getTime());
          if (diff < 45 * 60 * 1000) {
            moonEventLabel = `Moonrise at ${mTimes.rise.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
          }
        }
        if (mTimes.set && !moonEventLabel) {
          const diff = Math.abs(data.timestamp.getTime() - mTimes.set.getTime());
          if (diff < 45 * 60 * 1000) {
            moonEventLabel = `Moonset at ${mTimes.set.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
          }
        }

        return (
          <div style={boxStyle}>
            <p style={{ color: '#fff', margin: 0 }}>{moon.label}</p>
            <p style={{ color: '#aaa', margin: 0 }}>{Math.round(moon.fraction * 100)}% Illuminated</p>
            <div style={{ height: '1px', backgroundColor: '#444', margin: '4px 0' }} />
            {moonEventLabel ? (
              <p style={{ color: '#fbbf24', margin: 0, fontWeight: 'bold' }}>{moonEventLabel}</p>
            ) : (
              <p style={{ color: '#ccc', margin: 0 }}>Altitude: {Math.round(moonPos.altitude)}°</p>
            )}
            <p style={{ color: '#888', margin: 0, fontSize: '10px' }}>Azimuth: {Math.round(moonPos.azimuth)}°</p>
          </div>
        );
      case 'sun':
        const sunPos = getSunPosition(data.timestamp, currentLocation.latitude, currentLocation.longitude);

        // Check Sun Rise/Set
        const sTimes = SunCalc.getTimes(data.timestamp, currentLocation.latitude, currentLocation.longitude);
        let sunEventLabel: string | null = null;

        if (sTimes.sunrise) {
          const diff = Math.abs(data.timestamp.getTime() - sTimes.sunrise.getTime());
          if (diff < 45 * 60 * 1000) {
            sunEventLabel = `Sunrise at ${sTimes.sunrise.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
          }
        }
        if (sTimes.sunset && !sunEventLabel) {
          const diff = Math.abs(data.timestamp.getTime() - sTimes.sunset.getTime());
          if (diff < 45 * 60 * 1000) {
            sunEventLabel = `Sunset at ${sTimes.sunset.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
          }
        }

        return (
          <div style={boxStyle}>
            {sunEventLabel ? (
              <p style={{ color: '#fbbf24', margin: 0, fontWeight: 'bold' }}>{sunEventLabel}</p>
            ) : (
              <p style={{ color: '#fbbf24', margin: 0 }}>Sun Altitude: {Math.round(sunPos.altitude)}°</p>
            )}
            <p style={{ color: '#aaa', margin: 0 }}>Azimuth: {Math.round(sunPos.azimuth)}°</p>
            <p style={{ color: '#ccc', margin: 0, fontSize: '10px' }}>{sunPos.isUp ? 'Day' : 'Night'}</p>
          </div>
        );
      case 'waterTemp':
        if (data.waterTemperature === null || data.waterTemperature === undefined) return null;
        return <div style={boxStyle}><p style={{ color: '#fff', margin: 0 }}>Water: {data.waterTemperature.toFixed(1)}{unitLabels.temp}</p></div>;
      case 'marine':
        // Calculate conversions if needed or display raw
        // MarineChart logic uses: (val || 0) * multiplier
        const isImperial = settings.units === 'imperial';
        const mult = isImperial ? 3.28084 : 1;
        const marineUnit = isImperial ? 'ft' : 'm';

        const wave = data.waveHeight !== null ? (data.waveHeight * mult).toFixed(1) : '-';
        const swell = data.swellHeight !== null ? (data.swellHeight * mult).toFixed(1) : '-';

        return (
          <div style={boxStyle}>
            <p style={{ color: '#006994', margin: 0 }}>Wave: {wave}{marineUnit}</p>
            <p style={{ color: '#9c27b0', margin: 0 }}>Swell: {swell}{marineUnit}</p>
          </div>
        );
      default: return null;
    }
  };

  // Render Charts
  const renderChart = (id: string) => {
    switch (id) {
      case 'temperature':
        return (
          <WeatherPanel
            key="temperature"
            title={
              <span>
                Temperature
                {settings.temp.showDewPoint && <span style={{ color: '#a0aec0' }}> & Dew Point</span>}
                {' '}({unitLabels.temp})
              </span>
            }
            height={commonHeight}
            axis={<StickyAxis domain={tempDomain} ticks={tempTicks} height={commonHeight} margin={{ top: 20, right: 0, left: 0, bottom: 20 }} />}
            tooltip={selectedData ? getTooltipContent('temp', selectedData) : null}
            tooltipLeft={tooltipLeft}
          >
            <TemperatureChart
              data={processedData}
              width={totalWidth}
              height={commonHeight}
              syncId={syncId}
              nowIndex={nowIndex}
              domain={tempDomain}
              ticks={tempTicks}
              showFeelsLike={settings.temp.showFeelsLike}
              showDewPoint={settings.temp.showDewPoint}
              showDailyHighLow={settings.temp.showDailyHighLow}
              units={settings.units}
              timezone={currentLocation.timezone}
            />
          </WeatherPanel>
        );
      case 'moon':
        return (
          <WeatherPanel
            key="moon"
            title="Moon"
            height={80} // Doubled height
            axis={
              <StickyAxis
                domain={[0, 1]}
                ticks={[0, 0.5, 1]}
                height={80}
                tickFormatter={(v: number) => {
                  if (v === 0) return '0%';
                  if (v === 0.5) return '50%';
                  return '100%';
                }}
                margin={{ top: 0, right: 0, left: 0, bottom: 0 }}
                tick={({ x, y, payload }: any) => {
                  // Custom Tick to fix clipping at edges
                  const isFull = payload.value === 1;
                  const isNew = payload.value === 0;
                  const isHalf = payload.value === 0.5;

                  // Shift Full (Top) DOWN, New (Bottom) UP
                  const dy = isFull ? 8 : (isNew ? -2 : 3);

                  return (
                    <text
                      x={x}
                      y={y}
                      dy={dy}
                      textAnchor="end"
                      fill="#aaa"
                      fontSize={9}
                      fontWeight={500}
                    >
                      {isHalf ? '50%' : (isNew ? '0%' : '100%')}
                    </text>
                  );
                }}
              />
            }
            tooltip={selectedData ? getTooltipContent('moon', selectedData) : null}
            tooltipLeft={tooltipLeft}
          >
            <MoonPhaseRow
              data={processedData}
              width={totalWidth}
              hourWidth={hourWidth}
              lat={currentLocation.latitude}
              lon={currentLocation.longitude}
              nowIndex={nowIndex}
              height={80}
            />
          </WeatherPanel>
        );
      case 'precipitation':
        return (
          <WeatherPanel
            key="precipitation"
            title={
              <span>
                <span style={{ color: '#ab47bc' }}>Precipitation Chance</span>
                {settings.precip.showHumidity && <> & <span style={{ color: '#a0aec0' }}>Humidity</span></>}
                {' '}(%)
              </span>
            }

            height={commonHeight}
            axis={< StickyAxis domain={[0, 1]} ticks={precipTicks} height={commonHeight} tickFormatter={(v: number) => `${Math.round(v * 100)}`
            } />}
            tooltip={selectedData ? getTooltipContent('precip', selectedData) : null}
            tooltipLeft={tooltipLeft}
          >
            <PrecipitationChart
              data={processedData}
              width={totalWidth}
              height={commonHeight}
              syncId={syncId}
              ticks={precipTicks}
              showHumidity={settings.precip.showHumidity}
              showAmount={settings.precip.showAmount}
              showThunder={settings.precip.showThunder}
              showAccumulation={settings.precip.showAccumulation}
              nowIndex={nowIndex}
              units={settings.units}
            />
          </WeatherPanel >
        );
      case 'wind':
        return (
          <WeatherPanel
            key="wind"
            title={
              <span>
                Wind <span style={{ color: '#ccc' }}>|</span> <span style={{ color: '#f97316' }}>Gusts</span>
                {' '}({unitLabels.wind})
              </span>
            }
            height={commonHeight}
            axis={<StickyAxis domain={windDomain} height={commonHeight} ticks={windTicks} margin={{ top: 20, right: 0, left: 0, bottom: 5 }} />}
            tooltip={selectedData ? getTooltipContent('wind', selectedData) : null}
            tooltipLeft={tooltipLeft}
          >
            <WindChart
              data={processedData}
              width={totalWidth}
              height={commonHeight}
              syncId={syncId}
              domain={windDomain}
              ticks={windTicks}
              nowIndex={nowIndex}
              showDailyHigh={settings.wind.showDailyHigh}
              timezone={currentLocation.timezone}
              units={settings.units}
            />
          </WeatherPanel>
        );
      case 'sky':
        return (
          <WeatherPanel
            key="sky"
            title={<span><span style={{ color: '#fbbf24' }}>Sun</span> & Sky Cover (%)</span>}
            height={commonHeight}
            axis={<StickyAxis domain={[0, 1]} ticks={precipTicks} height={commonHeight} tickFormatter={(v: number) => `${Math.round(v * 100)}`} />}
            // Combine Tooltips: Sky Cover + Sun Altitude
            tooltip={selectedData ? (
              <>
                {getTooltipContent('sky', selectedData)}
                {getTooltipContent('sun', selectedData)}
              </>
            ) : null}
            tooltipLeft={tooltipLeft}
          >
            <SkyCoverChart
              data={processedData}
              width={totalWidth}
              height={commonHeight}
              syncId={syncId}
              ticks={precipTicks}
              nowIndex={nowIndex}
              lat={currentLocation.latitude}
              lon={currentLocation.longitude}
            />
          </WeatherPanel>
        );
      case 'tide':
        const hasTideData = !!tideStation || processedData.some(d => d.tideHeight !== null);

        if (!hasTideData) {
          return (
            <WeatherPanel
              key="tide"
              title={
                <span>
                  Tide Height <span style={{ color: '#555', fontSize: '0.9em' }}>- NO DATA AT THIS LOCATION</span>
                </span>
              }
              height={0}
            >
              <></>
            </WeatherPanel>
          );
        }

        const tideTitle = tideStation ? `Tide Height (${unitLabels.tide}) - ${tideStation.name}` : `Tide Height (${unitLabels.tide})`;

        return (
          <WeatherPanel
            key="tide"
            title={tideTitle}
            height={90}
            axis={<StickyAxis domain={tideDomain} ticks={tideTicks} height={90} />}
            tooltip={selectedData ? getTooltipContent('tide', selectedData) : null}
            tooltipLeft={tooltipLeft}
          >
            <TideChart
              data={processedData}
              width={totalWidth}
              height={90}
              syncId={syncId}
              domain={tideDomain}
              ticks={tideTicks}
              nowIndex={nowIndex}
              alertThreshold={
                tideStation?.alertThreshold !== undefined
                  ? (settings.units === 'metric' ? tideStation.alertThreshold * 0.3048 : tideStation.alertThreshold)
                  : undefined
              }
              showHighLow={settings.tide?.showHighLow}
            />
          </WeatherPanel>
        );
      case 'marine':
        const displayMaxWave = Math.max(...processedData.map(d => d.waveHeight || 0));
        const marineDomain: [number, number] = [0, Math.ceil((displayMaxWave || 10) * 1.2)];

        const marineUnit = settings.units === 'imperial' ? 'ft' : 'm';

        return (
          <WeatherPanel
            key="marine"
            title={
              <span>
                <span style={{ color: '#006994' }}>Wave</span> & <span style={{ color: '#9c27b0' }}>Swell</span> Height
                {' '}({marineUnit})
              </span>
            }
            height={130}
            axis={<StickyAxis domain={marineDomain} height={130} />}
            tooltip={selectedData ? getTooltipContent('marine', selectedData) : null}
            tooltipLeft={tooltipLeft}
          >
            <MarineChart
              data={processedData}
              width={totalWidth}
              height={130}
              syncId={syncId}
              nowIndex={nowIndex}
              units={settings.units}
            />
          </WeatherPanel>
        );
      case 'waterTemp':
        const wTemps = processedData.map(d => d.waterTemperature).filter(t => t !== null) as number[];
        const minWT = Math.min(...wTemps);
        const maxWT = Math.max(...wTemps);
        const bufferWT = 2;
        // Nice round domain
        const wDomain: [number, number] = [
          Number.isFinite(minWT) ? Math.floor((minWT - bufferWT) / 2) * 2 : 0,
          Number.isFinite(maxWT) ? Math.ceil((maxWT + bufferWT) / 2) * 2 : 20
        ];
        const wTicks = getLinearTicks(wDomain[0], wDomain[1], 2);

        return (
          <WeatherPanel
            key="waterTemp"
            title={`Water Temp (${unitLabels.temp})`}
            height={commonHeight}
            axis={<StickyAxis domain={wDomain} height={commonHeight} ticks={wTicks} />}
            tooltip={selectedData ? getTooltipContent('waterTemp', selectedData) : null}
            tooltipLeft={tooltipLeft}
          >
            <WaterTempChart
              data={processedData}
              width={totalWidth}
              height={commonHeight}
              syncId={syncId}
              nowIndex={nowIndex}
              domain={wDomain}
              ticks={wTicks}
            />
          </WeatherPanel>
        );
      case 'aqi':
        return (
          <WeatherPanel
            key="aqi"
            title="Air Quality Index"
            height={commonHeight}
            axis={<StickyAxis domain={[0, 200]} ticks={[0, 50, 100, 150, 200]} height={commonHeight} />}
            tooltip={selectedData ? getTooltipContent('aqi', selectedData) : null}
            tooltipLeft={tooltipLeft}
          >
            <AQIChart
              data={processedData}
              width={totalWidth}
              height={commonHeight}
              syncId={syncId}
              nowIndex={nowIndex}
              ticks={[0, 50, 100, 150, 200]}
            />
          </WeatherPanel>
        );
      case 'uv':
        return (
          <WeatherPanel
            key="uv"
            title="UV Index"
            height={commonHeight}
            axis={<StickyAxis domain={[0, 12]} ticks={[0, 3, 6, 9, 12]} height={commonHeight} />}
            tooltip={selectedData ? getTooltipContent('uv', selectedData) : null}
            tooltipLeft={tooltipLeft}
          >
            <UVChart
              data={processedData}
              width={totalWidth}
              height={commonHeight}
              syncId={syncId}
              nowIndex={nowIndex}
              ticks={[0, 3, 6, 9, 12]}
            />
          </WeatherPanel>
        );
      default: return null;
    }
  };

  // Dynamic Branding (Title & Favicon)
  useEffect(() => {
    document.title = currentConfig.appName;
    const link = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
    if (link) {
      link.href = currentConfig.mode === 'idealtime' ? '/tit-logo.png' : '/weather-plot-favicon.svg';
    }
  }, []);

  // Hydrate from URL params (Cross-Site Sync & Sharing)
  useEffect(() => {
    // Wait for activities to check for conflicts (prevents overwrite)
    if (!activitiesLoaded) return;

    const params = new URLSearchParams(window.location.search);
    let dirty = false;

    // 1. Cross-Site Sync Params
    const lat = params.get('import_lat');
    const lon = params.get('import_lon');

    if (lat && lon) {
      console.log('[Hydration] Found Import Params');
      const newLoc: LocationResult = {
        id: 0,
        elevation: 0,
        name: params.get('import_name') || 'Imported Location',
        latitude: parseFloat(lat),
        longitude: parseFloat(lon),
        admin1: params.get('import_admin1') || undefined,
        country_code: params.get('import_country') || '',
        timezone: params.get('import_tz') ?? 'UTC',
      };

      // Delay slightly to ensure app is ready
      setTimeout(() => setCurrentLocation(newLoc), 50);

      const units = params.get('import_units');
      if (units && (units === 'imperial' || units === 'metric')) {
        updateSettings(prev => ({ ...prev, units: units as 'imperial' | 'metric' }));
      }
      dirty = true;
    }

    // 2. Share Link (Full Activity + Location)
    const shareParam = params.get('share');
    if (shareParam) {
      console.log('[Hydration] Found Share Param');
      try {
        const data = decodeShareData(shareParam);
        console.log('[Hydration] Decoded:', data);

        if (data) {
          if (data.location) {
            const newLoc: LocationResult = {
              id: 0,
              elevation: 0,
              name: data.location.name,
              latitude: data.location.lat,
              longitude: data.location.lon,
              admin1: data.location.admin1,
              country_code: data.location.country || '',
              timezone: 'UTC'
            };
            console.log('[Hydration] Setting Location:', newLoc);
            setTimeout(() => setCurrentLocation(newLoc), 100); // 100ms delay to override any defaults
          }

          if (data.activity) {
            console.log('[Hydration] Setting Activity:', data.activity.name);
            setActivities(prev => {
              console.log('[Hydration] Current Activities:', prev);

              // If same activity exists (by name), assume it's already there (maybe user refreshed)
              // UPDATE: Actually, let's allow overwrite if they explicitly shared it. 
              // But for now, let's keep duplicate check but log it.
              const exists = prev.find(a => a.name === data.activity!.name);
              if (exists) {
                console.log('[Hydration] Activity already exists:', exists.name);
                // For now, let's NOT return early, let's ask if they want to overwrite?
                // Or just select it?
                // Let's simpler: If exists, do nothing? (User might be confused why it didn't update)
                // Let's ask to overwrite.
              }

              if (prev.length > 0) {
                // Synchronous confirm (blocks UI paint, but works for logic)
                // We need to use a short timeout ONLY if we want UI to paint "Loading" or something, 
                // but here we just want logic working.
                if (confirm(`Import shared activity "${data.activity?.name}"? This will overwrite your current list.`)) {
                  return [data.activity!];
                }
                return prev;
              }
              return [data.activity!];
            });
          }
          dirty = true;
        }
      } catch (e) {
        console.error('[Hydration] Error decoding share:', e);
      }
    }

    // Clean URL if we processed anything
    if (dirty) {
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [activitiesLoaded]);

  return (
    <div className="app-container" onWheel={handleWheel}>
      <header className="app-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* Logo */}
          <img
            src={currentConfig.mode === 'idealtime' ? '/tit-logo.png' : '/weather-plot-favicon.svg'}
            alt={`${currentConfig.appName} Logo`}
            style={{ height: '36px', width: '36px', cursor: 'pointer' }}
            onClick={() => timelineRef.current?.scrollToNow()}
          />

          {/* Title Stack */}
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <h1
              onClick={() => timelineRef.current?.scrollToNow()}
              style={{
                margin: 0,
                fontSize: '16px',
                fontWeight: 600,
                cursor: 'pointer',
                userSelect: 'none',
                WebkitUserSelect: 'none',
                color: '#fff',
                lineHeight: 1.2,
                whiteSpace: 'nowrap'
              }}
            >{currentConfig.appName}</h1>

            <LocationSearch
              currentLocationName={`${currentLocation.name}${currentLocation.admin1 ? `, ${currentLocation.admin1}` : (currentLocation.country_code ? `, ${currentLocation.country_code}` : '')}`}
              onLocationSelect={setCurrentLocation}
            />
          </div>
        </div>
        <div className="header-controls">
          {currentConfig.features.activityBuilder && (
            <button
              className="icon-button"
              onClick={() => setIsManagerOpen(true)}
              style={{
                background: 'rgba(16, 185, 129, 0.2)', // Green tint
                border: '1px solid rgba(16, 185, 129, 0.4)',
                cursor: 'pointer',
                color: '#10b981',
                padding: '4px 6px',
                borderRadius: '4px',
                fontSize: '12px',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              Activities
            </button>
          )}

          <StatusIndicator
            lastFetchTime={lastFetchTime}
            currentTime={currentTime}
            onRefresh={() => loadData(true)}
            isLoading={loading}
          />

          <ShareButton
            currentLocation={currentLocation}
            activity={activities.length > 0 ? activities[0] : undefined}
            mode={currentConfig.mode}
          />
          <button
            className="icon-button"
            onClick={() => setIsSettingsOpen(true)}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: '#888',
              padding: '4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'color 0.2s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.color = '#fff'}
            onMouseLeave={(e) => e.currentTarget.style.color = '#888'}
            title="Settings"
          >
            <Settings size={18} />
          </button>

          {/* Account / Cross-Link Placeholder */}
          <button
            className="icon-button"
            onClick={() => {
              if (currentConfig.mode === 'weatherplot') {
                const isStaging = window.location.hostname.includes('staging') || window.location.hostname.includes('web.app');
                const baseUrl = isStaging ? 'https://staging.theidealtime.com' : 'https://theidealtime.com';

                // Pack state
                const params = new URLSearchParams();
                params.set('import_lat', currentLocation.latitude.toString());
                params.set('import_lon', currentLocation.longitude.toString());
                params.set('import_name', currentLocation.name);
                if (currentLocation.admin1) params.set('import_admin1', currentLocation.admin1);
                if (currentLocation.country_code) params.set('import_country', currentLocation.country_code);
                if (currentLocation.timezone) params.set('import_tz', currentLocation.timezone);
                params.set('import_units', settings.units);

                window.location.href = `${baseUrl}?${params.toString()}`;
              } else {
                if (user) {
                  // If logged in, maybe show a menu? For now, just confirm logout
                  if (confirm(`Logged in as ${user.email}. Sign out?`)) {
                    logout();
                  }
                } else {
                  signInWithGoogle();
                }
              }
            }}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: user ? '#10b981' : '#888', // Green if logged in
              padding: '4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'color 0.2s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.color = '#fff'}
            onMouseLeave={(e) => e.currentTarget.style.color = user ? '#10b981' : '#888'}
            title={currentConfig.mode === 'idealtime' ? (user ? `Signed in as ${user.email}` : 'Sign In') : 'The Ideal Time'}
          >
            {currentConfig.mode === 'idealtime' ? (
              <User size={18} />
            ) : (
              <img src="/tit-logo.png" style={{ width: '18px', height: '18px' }} alt="TIT" />
            )}
          </button>
        </div>
      </header>



      <SettingsDialog
        open={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onUpdate={updateSettings}
      />

      {/* Manager Modal (Lists activities) */}
      {isActivityBuilderOpen && !editingActivity && !activities.find(a => a.id === 'NEW_HACK') /* Dirty hacks to reuse boolean, let's fix this properly */}

      {/* 
        Refactoring Logic:
        We used `isActivityBuilderOpen` for the builder.
        Now we have a Manager AND a Builder.
        Let's split the state or handle the logic carefully.
        
        State:
        - isManagerOpen (List)
        - isBuilderOpen (Edit/Create)
        
        Button -> Opens Manager
        Manager "Edit" -> Opens Builder (Manager stays? or Closes? Probably closes or hidden)
        Manager "New" -> Opens Builder
      */}

      {isManagerOpen && (
        <ActivityManager
          activities={activities}
          isPremium={isPremium}
          onClose={() => setIsManagerOpen(false)}
          onEdit={(activity) => {
            setEditingActivity(activity);
            setIsManagerOpen(false);
            setIsActivityBuilderOpen(true);
          }}
          onDelete={async (id) => {
            await activityStore.delete(id, user?.uid);
            const updated = await activityStore.getAll(user?.uid);
            const sorted = user ? updated.sort((a: any, b: any) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)) : updated;
            setActivities(sorted);
          }}
          onCreate={() => {
            setEditingActivity(undefined);
            setIsManagerOpen(false);
            setIsActivityBuilderOpen(true);
          }}
          onReorder={async (newOrder) => {
            // Optimistic update
            setActivities(newOrder);
            await activityStore.reorder(newOrder, user?.uid);
          }}
          onSync={handleSync}
          isSyncing={isSyncing}
          userId={user?.uid}
        />
      )}

      {isActivityBuilderOpen && (
        <ActivityBuilder
          currentLocation={currentLocation}
          existingActivity={editingActivity}
          settings={settings}
          onClose={() => {
            setIsActivityBuilderOpen(false);
            setEditingActivity(undefined);
            setIsManagerOpen(true); // Return to list on close
          }}
          onSave={async (savedActivity) => {
            await activityStore.save(savedActivity, user?.uid);
            // Refresh
            const updated = await activityStore.getAll(user?.uid);
            const sorted = user ? updated.sort((a: any, b: any) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)) : updated;
            setActivities(sorted);
            setIsActivityBuilderOpen(false);
            setEditingActivity(undefined);
            setIsManagerOpen(true); // Return to list on save
          }}
        />
      )}

      {loading && <div className="loading-overlay">Loading Weather Data...</div>}
      {error && <div className="error-overlay">{error}</div>}

      {!loading && !error && (
        <main className="app-main">
          {/* Global Time Label Overlay */}
          {selectedData && tooltipLeft !== undefined && (
            <div
              style={{
                position: 'absolute',
                top: '50px', // Below the header
                left: '0',
                width: '100%',
                pointerEvents: 'none',
                zIndex: 999,
                // We need to sync X with the specific scroll position, which is tricky from outside.
                // Actually, if we put it HERE (outside timeline), we can't easily sync X.
                // So it MUST go inside TimelineContainer to pick up the X scroll.
                // BUT if it goes inside, it scrolls vertically away.
              }}
            >
              {/* Placeholder - We need to insert it inside TimelineContainer */}
            </div>
          )}

          <TimelineContainer
            ref={timelineRef}
            hours={weatherData.length > 0 ? weatherData.length : HOURS}
            hourWidth={hourWidth}
            startHourOffset={START_OFFSET}
            selectedIndex={selectedIndex}
            onTimeSelect={handleTimeSelect}
            nowIndex={nowIndex}
          >
            {/* Global Time Label - Sticky & Centered */}
            {selectedData && tooltipLeft !== undefined && (
              <div style={{
                position: 'absolute',
                left: tooltipLeft + 32, // X-Position: Moves with content
                top: 0,
                bottom: 0, // Span full height
                width: '1px', // Minimal width wrapper
                zIndex: 200,
                pointerEvents: 'none',
              }}>
                <div
                  style={{
                    position: 'sticky',
                    top: '52px', // Moved down below typical axis height
                    // left: tooltipLeft, // REMOVED: Wrapper already handles X position
                    width: 'fit-content',
                    transform: 'translateX(-50%)',
                    zIndex: 100,
                    backgroundColor: '#000',
                    color: '#fff',
                    padding: '4px 8px',
                    borderRadius: '4px',
                    fontSize: '12px',
                    fontWeight: 'bold',
                    whiteSpace: 'nowrap',
                    marginTop: '8px',
                    marginBottom: '8px',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.5)',
                    border: '1px solid #444',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    pointerEvents: 'auto' // Re-enable clicks
                  }}
                  onClick={(e) => e.stopPropagation()} // Prevent dismissing when clicking the box itself
                >
                  {/* Left Arrow */}
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      if (selectedIndex !== null && selectedIndex > 0) {
                        handleTimeSelect(selectedIndex - 1);
                      }
                    }}
                    style={{
                      cursor: 'pointer',
                      padding: '0 4px',
                      userSelect: 'none',
                      display: 'flex',
                      alignItems: 'center',
                      opacity: selectedIndex! > 0 ? 1 : 0.3
                    }}
                  >
                    <ChevronLeft size={16} />
                  </div>

                  <span>
                    {new Intl.DateTimeFormat('en-US', {
                      weekday: 'short',
                      hour: 'numeric',
                      minute: 'numeric',
                      timeZone: currentLocation.timezone
                    }).format(selectedData.timestamp)}
                  </span>

                  {/* Right Arrow */}
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      if (selectedIndex !== null && selectedIndex < weatherData.length - 1) {
                        handleTimeSelect(selectedIndex + 1);
                      }
                    }}
                    style={{
                      cursor: 'pointer',
                      padding: '0 4px',
                      userSelect: 'none',
                      display: 'flex',
                      alignItems: 'center',
                      opacity: selectedIndex! < weatherData.length - 1 ? 1 : 0.3
                    }}
                  >
                    <ChevronRight size={16} />
                  </div>
                </div>
              </div>
            )}

            {/* Axis */}
            <TimeAxis
              hours={weatherData.length > 0 ? weatherData.length : HOURS}
              hourWidth={hourWidth}
              startHourOffset={START_OFFSET}
              data={processedData}
              customStartTime={processedData.length > 0 ? processedData[0].timestamp : undefined}
              timezone={currentLocation.timezone}
            />

            {/* Activities: One Panel per Activity */}
            {/* Activities: One Panel per Activity */}
            {currentConfig.features.trafficLightPlot && activities.map(activity => (
              <WeatherPanel
                key={activity.id}
                title={
                  <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                    <span style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      flex: 1,
                      fontSize: '0.9em',
                      color: '#ddd'
                    }}
                    >
                      <span style={{ fontSize: '1.2em' }}>{activity.icon}</span>
                      {activity.name.replace(/^ACTIVITY:?\s*/i, '')}

                    </span>
                  </div>
                }
                height={18}
                axis={
                  <div style={{
                    width: '100%',
                    height: '100%',
                    borderRight: '1px solid #333',
                    background: '#1e1e1e'
                  }} />
                }
              >
                <ActivityRow
                  points={weatherData}
                  activity={activity}
                  lat={currentLocation.latitude}
                  lon={currentLocation.longitude}
                  height={18}
                  onEdit={() => {
                    setEditingActivity(activity);
                    setIsActivityBuilderOpen(true);
                  }}
                />
              </WeatherPanel>
            ))}

            {/* Panels */}
            {settings.chartOrder
              .filter(chart => chart.visible)
              .map(chart => renderChart(chart.id))}

          </TimelineContainer>
        </main>
      )}

      {/* Footer for Legal Links (Required for Google Verification) */}
      <footer style={{
        position: 'fixed',
        bottom: '8px',
        right: '12px',
        fontSize: '10px',
        color: '#444',
        zIndex: 50,
        pointerEvents: 'auto'
      }}>
        <a href="/privacy" style={{ color: '#444', textDecoration: 'none', marginRight: '8px' }}>Privacy</a>
        <a href="/terms" style={{ color: '#444', textDecoration: 'none' }}>Terms</a>
      </footer>
    </div>
  );
}

export default App;
