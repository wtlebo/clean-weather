
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

export const findNearestStation = async (lat: number, lon: number): Promise<TideStation | null> => {
    const stations = await getAllTideStations();
    if (!stations.length) return null;

    let nearest: TideStation | null = null;
    let minDist = Infinity;

    for (const station of stations) {
        const dist = getDistanceFromLatLonInMiles(lat, lon, station.lat, station.lng);
        if (dist < minDist) {
            minDist = dist;
            nearest = { ...station, distance: dist };
        }
    }

    // Cutoff: 50 miles
    if (nearest && minDist <= 50) {
        return nearest;
    }

    return null;
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
            datum: 'MSL', // Use Mean Sea Level to show +/- values around 0
            station: stationId,
            time_zone: 'gmt', //: Important: API supports 'gmt' or 'lst_ldt'. GMT is safer for parsing.
            units: 'english', // feet
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

export const fetchStationDatums = async (stationId: string): Promise<{ MHHW: number; HAT: number; MSL: number } | null> => {
    try {
        const url = `https://api.tidesandcurrents.noaa.gov/mdapi/prod/webapi/stations/${stationId}/datums.json`;
        const response = await fetch(url);
        if (!response.ok) throw new Error('Failed to fetch datums');
        const data = await response.json();

        // Extract Datums from the 'datums' array or top-level props
        // Top level HAT is convenient. MSL usually in array.
        // Let's look for them in the array for safety (except HAT might be computed/top-level only?)
        // My content view showed 'HAT' at top level and 'datums' array.

        const mslDatum = data.datums?.find((d: any) => d.name === 'MSL');
        const mhhwDatum = data.datums?.find((d: any) => d.name === 'MHHW');

        // HAT depends on station status, usually top level.
        const hat = data.HAT;

        if (mslDatum && hat !== undefined) {
            return {
                MSL: mslDatum.value,
                HAT: hat,
                MHHW: mhhwDatum?.value || 0
            };
        }
        return null;
    } catch (error) {
        console.error('Error fetching NOAA datums:', error);
        return null;
    }
};
