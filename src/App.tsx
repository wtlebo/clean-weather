import React, { useMemo, useState, useCallback, useEffect } from 'react';
import { Settings } from 'lucide-react';
import { TimelineContainer } from './components/layout/TimelineContainer';
import { TimeAxis } from './components/layout/TimeAxis';
import { WeatherPanel } from './components/panels/WeatherPanel';
import { TemperatureChart } from './components/charts/TemperatureChart';
import { WindChart } from './components/charts/WindChart';
import { PrecipitationChart } from './components/charts/PrecipitationChart';
import { SkyCoverChart } from './components/charts/SkyCoverChart';
import { TideChart } from './components/charts/TideChart';
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
import './App.css';

// Configuration
const HOURS = 240; // 10 days
const DEFAULT_HOUR_WIDTH = 10; // px - Condensed for mobile
const START_OFFSET = 120; // 5 days back

function App() {
  // Scale state for pinch-to-zoom
  const [hourWidth, setHourWidth] = useState(DEFAULT_HOUR_WIDTH);

  // Data & State
  // Default Location: New York (or load from storage)
  const [currentLocation, setCurrentLocation] = useState<LocationResult>(() => {
    try {
      const saved = localStorage.getItem('weather_location');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error('Failed to load location', e);
    }
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

  const [settings, setSettings] = useState<AppSettings>(() => {
    try {
      const saved = localStorage.getItem('weather_settings');
      if (saved) return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) }; // Merge to handle new keys
    } catch (e) {
      console.error('Failed to load settings', e);
    }
    return DEFAULT_SETTINGS;
  });
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Fetch Data on Location Change
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      setError(null);
      try {
        const { points, tideStation } = await fetchWeatherData(
          currentLocation.latitude,
          currentLocation.longitude,
          currentLocation.timezone
        );
        setWeatherData(points);
        setTideStation(tideStation);
      } catch (err) {
        console.error(err);
        setError("Failed to load weather data");
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [currentLocation]);

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
      } else {
        // Imperial
        // F -> F
        // mph -> mph
        // mm -> in
        precip = precip / 25.4;
        // Meters -> Feet
        if (tide !== null) tide = tide * 3.28084;
      }

      // Calculate Visual Intensity (NWS Standards) based on Inches
      // Light < 0.1", Moderate 0.1-0.3", Heavy > 0.3"
      const precipInches = isMetric ? precip / 25.4 : precip;
      let precipIntensity = 0;
      if (precipInches > 0) {
        if (precipInches < 0.10) precipIntensity = 0.25; // 25% Height
        else if (precipInches < 0.30) precipIntensity = 0.50; // 50% Height
        else precipIntensity = 0.75; // 75% Height (Never 100%)
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
        tideHeight: tide
      };
    });
  }, [weatherData, settings.units]);

  // 2. Derive Domains from Processed Data
  const tempDomain = useMemo(() => {
    const temps = processedData.map(d => d.temperature);
    const feels = settings.temp.showFeelsLike ? processedData.map(d => d.feelsLike) : [];
    const minVal = Math.min(...temps, ...feels);
    const maxVal = Math.max(...temps, ...feels);
    return [Math.floor(minVal - 5), Math.ceil(maxVal + 5)] as [number, number];
  }, [processedData, settings.temp.showFeelsLike]);

  const windDomain = useMemo(() => {
    const speeds = processedData.map(d => Math.max(d.windSpeed, d.windGust || 0));
    return [0, Math.ceil(Math.max(...speeds) + (settings.units === 'metric' ? 2 : 5))] as [number, number];
  }, [processedData, settings.units]);

  const tideDomain = useMemo(() => {
    const values = processedData.map(d => d.tideHeight ?? 0);
    const maxAbs = Math.ceil(Math.max(...values.map(v => Math.abs(v))) * 10) / 10;
    const limit = Math.max(settings.units === 'metric' ? 1 : 3, maxAbs);
    return [-limit, limit] as [number, number];
  }, [processedData, settings.units]);

  // 3. Generate Ticks
  const getLinearTicks = (min: number, max: number, step: number) => {
    const ticks = [];
    const start = Math.ceil(min / step) * step;
    for (let i = start; i <= max; i += step) {
      ticks.push(i);
    }
    return ticks;
  };

  const tempTicks = useMemo(() => getLinearTicks(tempDomain[0], tempDomain[1], settings.units === 'metric' ? 5 : 10), [tempDomain, settings.units]);
  const windTicks = useMemo(() => getLinearTicks(windDomain[0], windDomain[1], settings.units === 'metric' ? 5 : 5), [windDomain, settings.units]);
  const precipTicks = [0, 0.25, 0.5, 0.75, 1];
  const tideTicks = useMemo(() => {
    const range = tideDomain[1] - tideDomain[0];
    const step = range > (settings.units === 'metric' ? 4 : 12) ? (settings.units === 'metric' ? 1 : 2) : (settings.units === 'metric' ? 0.5 : 1);
    return getLinearTicks(tideDomain[0], tideDomain[1], step);
  }, [tideDomain, settings.units]);

  // Calculate "Now" position
  const nowIndex = useMemo(() => {
    if (processedData.length === 0) return START_OFFSET;

    // Find the fractional index corresponding to "now"
    const now = new Date();
    const startTime = processedData[0].timestamp; // Local time object
    const diffHours = (now.getTime() - startTime.getTime()) / (1000 * 60 * 60);

    // Clamp to valid range
    const index = Math.max(0, Math.min(processedData.length - 1, diffHours));
    return Math.round(index); // Round to match integer index for Recharts
  }, [processedData]);

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
        return <div style={boxStyle}><p style={{ color: '#fff', margin: 0 }}>Tide: {data.tideHeight.toFixed(2)}{unitLabels.tide}</p></div>;
      default: return null;
    }
  };

  // Render Charts
  const renderChart = (id: string) => {
    switch (id) {
      case 'temp':
        return (
          <WeatherPanel
            key="temp"
            title={
              <span>
                Temperature
                {settings.temp.showDewPoint && <span style={{ color: '#a0aec0' }}> & Dew Point</span>}
                {' '}({unitLabels.temp})
              </span>
            }
            height={commonHeight}
            axis={<StickyAxis domain={tempDomain} ticks={tempTicks} height={commonHeight} />}
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
            />
          </WeatherPanel>
        );
      case 'precip':
        return (
          <WeatherPanel
            key="precip"
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
              nowIndex={nowIndex}
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
            axis={<StickyAxis domain={windDomain} height={commonHeight} ticks={windTicks} />}
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
        let tideTitle = 'Tide Height - No Data at this Location';
        if (tideStation) {
          tideTitle = `Tide Height (${unitLabels.tide}) - ${tideStation.name}`;
        } else if (processedData.some(d => d.tideHeight !== null)) {
          tideTitle = `Tide Height (${unitLabels.tide})`;
        }

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
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div className="logo">Clean Weather</div>
          <LocationSearch
            currentLocationName={currentLocation.name}
            onLocationSelect={setCurrentLocation}
          />
        </div>
        <div className="header-controls">
          <div className="status-indicator" title="Data Status"></div>
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
          <TimelineContainer
            hours={weatherData.length > 0 ? weatherData.length : HOURS}
            hourWidth={hourWidth}
            startHourOffset={START_OFFSET}
            selectedIndex={selectedIndex}
            onTimeSelect={handleTimeSelect}
            nowIndex={nowIndex}
          >
            {/* Axis */}
            <TimeAxis
              hours={weatherData.length > 0 ? weatherData.length : HOURS}
              hourWidth={hourWidth}
              startHourOffset={START_OFFSET}
              data={processedData}
              customStartTime={processedData.length > 0 ? processedData[0].timestamp : undefined}
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
