import React, { useMemo, useState, useCallback, useEffect } from 'react';
import { Settings } from 'lucide-react';
import { getMoonData } from './utils/moon';
import { MoonPhaseRow } from './components/charts/MoonPhaseRow';

import { TimelineContainer, type TimelineHandle } from './components/layout/TimelineContainer';

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
import { ShareButton } from './components/ShareButton';
import { serializeSettings, parseSettings, serializeLocation, parseLocation, mergeSettings } from './utils/url';
import './App.css';

// Configuration
const HOURS = 240; // 10 days
const DEFAULT_HOUR_WIDTH = 10; // px - Condensed for mobile
const START_OFFSET = 120; // 5 days back

function App() {
  // Scale state for pinch-to-zoom
  const [hourWidth, setHourWidth] = useState(DEFAULT_HOUR_WIDTH);

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
      timezone: "America/New_York"
    };
  });

  const [weatherData, setWeatherData] = useState<WeatherPoint[]>([]);
  const [tideStation, setTideStation] = useState<{ name: string; distance: number; alertThreshold?: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastFetchTime, setLastFetchTime] = useState<Date | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());

  const [settings, setSettings] = useState<AppSettings>(() => {
    // 1. Try URL
    const params = new URLSearchParams(window.location.search);
    // Determine if URL actually has settings? Check for 'u' or 'charts' or 't_opt'
    if (params.has('u') || params.has('charts') || params.has('t_opt')) {
      return parseSettings(params);
    }

    // 2. Try Storage
    try {
      const saved = localStorage.getItem('weather_settings');
      if (saved) return mergeSettings(JSON.parse(saved));
    } catch (e) {
      console.error('Failed to load settings', e);
    }
    return DEFAULT_SETTINGS;
  });
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const timelineRef = React.useRef<TimelineHandle>(null);

  // URL Synchronization
  useEffect(() => {
    // Debounce or just update? replaceState is cheap-ish.
    const params = new URLSearchParams();

    // Add Loc Params
    const locParams = serializeLocation(currentLocation);
    locParams.forEach((v, k) => params.set(k, v));

    // Add Settings Params
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
      const { points, tideStation, fetchedAt } = await fetchWeatherData(
        currentLocation.latitude,
        currentLocation.longitude,
        forceRefresh
      );
      setWeatherData(points);
      setTideStation(tideStation);
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
        console.log('Auto-refreshing weather data...');
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
        // Tide Metric (already meters)
        // Wave/Swell Metric (already meters)
      } else {
        // Imperial
        // F -> F
        // mph -> mph
        // mm -> in
        precip = precip / 25.4;
        // Meters -> Feet
        if (tide !== null) tide = tide * 3.28084;
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
        return <div style={boxStyle}><p style={{ color: '#fff', margin: 0 }}>Tide: {data.tideHeight.toFixed(2)}{unitLabels.tide}</p></div>;

      case 'moon':
        const moon = getMoonData(data.timestamp);
        return (
          <div style={boxStyle}>
            <p style={{ color: '#fff', margin: 0 }}>{moon.label}</p>
            <p style={{ color: '#aaa', margin: 0 }}>{Math.round(moon.fraction * 100)}% Illuminated</p>
          </div>
        );
      case 'waterTemp':
        if (data.waterTemperature === null || data.waterTemperature === undefined) return null;
        return <div style={boxStyle}><p style={{ color: '#fff', margin: 0 }}>Water: {data.waterTemperature.toFixed(1)}{unitLabels.temp}</p></div>;
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
            title="Moon Phase"
            height={40} // Tighter height
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
            title="Sky Cover (%)"
            height={commonHeight}
            axis={<StickyAxis domain={[0, 1]} ticks={precipTicks} height={commonHeight} tickFormatter={(v: number) => `${Math.round(v * 100)}`} />}
            tooltip={selectedData ? getTooltipContent('sky', selectedData) : null}
            tooltipLeft={tooltipLeft}
          >
            <SkyCoverChart
              data={processedData}
              width={totalWidth}
              height={commonHeight}
              syncId={syncId}
              ticks={precipTicks}
              nowIndex={nowIndex}
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
                  ? (settings.units === 'metric' ? tideStation.alertThreshold : tideStation.alertThreshold * 3.28084)
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

  return (
    <div className="app-container" onWheel={handleWheel}>
      <header className="app-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div
            style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}
            onClick={() => timelineRef.current?.scrollToNow()}
          >
            <img src="/weather-plot-favicon.svg" alt="Weather Plot Logo" style={{ height: '32px', width: '32px' }} />
            <h1 style={{ fontSize: '1.2rem', fontWeight: 600, margin: 0, color: '#fff' }}>Weather Plot</h1>
          </div>
          <div style={{ width: '1px', height: '24px', backgroundColor: '#333' }}></div>
          <LocationSearch
            currentLocationName={currentLocation.name}
            onLocationSelect={setCurrentLocation}
          />
        </div>
        <div className="header-controls">
          <StatusIndicator
            lastFetchTime={lastFetchTime}
            currentTime={currentTime}
            onRefresh={() => loadData(true)}
            isLoading={loading}
          />
          <ShareButton />
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
          >
            <Settings size={18} />
          </button>
        </div>
      </header>



      <SettingsDialog
        open={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onUpdate={setSettings}
      />

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
                <div style={{
                  position: 'sticky',
                  top: '52px', // Y-Position: Sticks to top (adjusted up)
                  left: 0, // Reset
                  width: 'fit-content',
                  transform: 'translateX(-50%)',
                  backgroundColor: '#333',
                  color: '#fff',
                  padding: '4px 8px',
                  borderRadius: '4px',
                  fontSize: '12px',
                  fontWeight: 'bold',
                  border: '1px solid #555',
                  marginTop: '4px',
                  whiteSpace: 'nowrap'
                }}>
                  {new Intl.DateTimeFormat('en-US', {
                    weekday: 'short',
                    hour: 'numeric',
                    minute: 'numeric',
                    timeZone: currentLocation.timezone
                  }).format(selectedData.timestamp)}
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



            {/* Panels */}
            {settings.chartOrder
              .filter(chart => chart.visible)
              .map(chart => renderChart(chart.id))}

          </TimelineContainer>
        </main>
      )}
    </div>
  );
}

export default App;
