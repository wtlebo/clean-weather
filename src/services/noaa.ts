
// NOAA CO-OPS API Service
// Documentation: https://api.tidesandcurrents.noaa.gov/api/prod/

const NOAA_API_BASE = 'https://api.tidesandcurrents.noaa.gov/api/prod/datagetter';
const STATIONS_URL = 'https://api.tidesandcurrents.noaa.gov/mdapi/prod/webapi/stations.json?type=tidepredictions';

export interface TideStation {
    id: string;
    name: string;
    lat: number;
    lng: number; // API uses 'lng' or 'lon', we'll map to standard
    distance?: number; // Distance in miles from user
}

export interface TidePrediction {
    t: string; // Time (YYYY-MM-DD HH:mm)
    v: string; // Value (Height in ft)
}

// Haversine formula to calculate distance in miles
const getDistanceFromLatLonInMiles = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 3959; // Radius of the earth in miles
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const d = R * c; // Distance in miles
    return d;
};

const deg2rad = (deg: number) => {
    return deg * (Math.PI / 180);
};

// Cache stations in memory to avoid repeated large fetches
let cachedStations: TideStation[] | null = null;

export const getAllTideStations = async (): Promise<TideStation[]> => {
    if (cachedStations) return cachedStations;

    try {
        const response = await fetch(STATIONS_URL);
        if (!response.ok) throw new Error('Failed to fetch NOAA stations');
        const data = await response.json();

        // Map raw response to our interface
        cachedStations = data.stations.map((s: any) => ({
            id: s.id,
            name: s.name,
            lat: s.lat,
            lng: s.lng
        }));

        return cachedStations || [];
    } catch (error) {
        console.error('Error fetching NOAA stations:', error);
        return [];
    }
};

export const findNearestStations = async (lat: number, lon: number, limit = 3): Promise<TideStation[]> => {
    const stations = await getAllTideStations();
    if (!stations.length) return [];

    // Calculate all distances
    const withDist = stations.map(s => ({
        ...s,
        distance: getDistanceFromLatLonInMiles(lat, lon, s.lat, s.lng)
    }));

    // Sort by distance
    withDist.sort((a, b) => a.distance - b.distance);

    // Filter by max distance (50 miles) and return top N
    return withDist.filter(s => s.distance <= 50).slice(0, limit);
};

// Helper to format date as YYYYMMDD
const formatDate = (date: Date): string => {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${yyyy}${mm}${dd}`;
};

export const fetchTidePredictions = async (stationId: string, startDate: Date, endDate: Date): Promise<TidePrediction[]> => {
    try {
        const beginDate = formatDate(startDate);
        const endDateStr = formatDate(endDate);

        const params = new URLSearchParams({
            product: 'predictions',
            application: 'CleanWeather',
            begin_date: beginDate,
            end_date: endDateStr,
            datum: 'MLLW', // Match standard tide charts (Mean Lower Low Water)
            station: stationId,
            time_zone: 'gmt', //: Important: API supports 'gmt' or 'lst_ldt'. GMT is safer for parsing.
            units: 'metric', // meters (App.tsx expects base metric data)
            interval: 'h', // Hourly
            format: 'json'
        });

        const url = `${NOAA_API_BASE}?${params.toString()}`;
        const response = await fetch(url);
        if (!response.ok) {
            // handle case where date range might be too long for one request? 
            // Docs say 1 year limit? We are asking for 15 days. Should be fine.
            throw new Error(`NOAA API Error: ${response.statusText}`);
        }

        const data = await response.json();
        if (data.error) {
            // NOAA returns JSON with error field for some cases
            console.error('NOAA API returned error:', data.error);
            return [];
        }

        return data.predictions || [];
    } catch (error) {
        console.error('Error fetching NOAA predictions:', error);
        return [];
    }
};

export const fetchStationDatums = async (stationId: string): Promise<{ MHHW: number; HAT: number; MSL: number; MLLW: number } | null> => {
    try {
        // Request Metric units for datums to match our prediction request
        const url = `https://api.tidesandcurrents.noaa.gov/mdapi/prod/webapi/stations/${stationId}/datums.json?units=metric`;
        const response = await fetch(url);
        if (!response.ok) throw new Error('Failed to fetch datums');
        const data = await response.json();

        // Extract Datums
        const mslDatum = data.datums?.find((d: any) => d.name === 'MSL');
        const mhhwDatum = data.datums?.find((d: any) => d.name === 'MHHW');
        const mllwDatum = data.datums?.find((d: any) => d.name === 'MLLW');

        // HAT depends on station status, usually top level.
        const hat = data.HAT;

        if (mslDatum && hat !== undefined && mllwDatum) {
            return {
                MSL: mslDatum.value,
                HAT: hat,
                MHHW: mhhwDatum?.value || 0,
                MLLW: mllwDatum.value
            };
        }
        return null;
        return null;
    } catch (error) {
        console.error('Error fetching NOAA datums:', error);
        return null;
    }
};
