
import { findNearestStation, getAllTideStations, fetchTidePredictions } from './src/services/noaa';

// Simplified distance function to avoid importing from noaa.ts if it's not exported
const getDist = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 3959;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
};

const GEOCODING_API = 'https://geocoding-api.open-meteo.com/v1/search';

const searchLocation = async (query: string) => {
    const url = `${GEOCODING_API}?name=${encodeURIComponent(query)}&count=1&language=en&format=json`;
    const response = await fetch(url);
    const data = await response.json();
    return data.results?.[0];
};

const run = async () => {
    // Try simpler query
    const query = "Newport Beach";
    console.log(`Geocoding "${query}"...`);
    const loc = await searchLocation(query);

    if (!loc) {
        console.error('Location not found');
        return;
    }

    console.log(`Location: ${loc.name} (${loc.latitude}, ${loc.longitude})`);

    const stations = await getAllTideStations();
    console.log(`Total stations: ${stations.length}`);

    // Calculate distances
    const stationsWithDist = stations.map(s => ({
        ...s,
        dist: getDist(loc.latitude, loc.longitude, s.lat, s.lng)
    })).sort((a, b) => a.dist - b.dist);

    console.log('Top 5 nearest stations:');
    stationsWithDist.slice(0, 5).forEach(s => {
        console.log(`- ${s.name} (ID: ${s.id}): ${s.dist.toFixed(2)} miles`);
    });

    const targetStation = stationsWithDist.find(s => s.name.includes("Santa Ana River"));
    if (targetStation) {
        console.log(`\nTesting target: ${targetStation.name} (${targetStation.id})...`);
        const startDate = new Date();
        const endDate = new Date();
        endDate.setDate(endDate.getDate() + 2);

        try {
            const preds = await fetchTidePredictions(targetStation.id, startDate, endDate);
            console.log(`Predictions found: ${preds.length}`);
            if (preds.length > 0) {
                console.log('Sample:', preds[0]);
            } else {
                console.log('Predictions array is empty.');
                // Debug response? fetchTidePredictions catches error and returns [], so we might not see the error details 
                // Let's manually fetch here to see error
                const beginDate = startDate.toISOString().split('T')[0].replace(/-/g, '');
                const endDateStr = endDate.toISOString().split('T')[0].replace(/-/g, '');
                const url = `https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?product=predictions&application=CleanWeather&begin_date=${beginDate}&end_date=${endDateStr}&datum=MLLW&station=${targetStation.id}&time_zone=gmt&units=metric&interval=h&format=json`;
                console.log('Manual fetch URL:', url);
                const r = await fetch(url);
                const d = await r.json();
                console.log('Manual response:', d);
            }
        } catch (e) {
            console.error('Error:', e);
        }
    } else {
        console.log('\n"Santa Ana River" station not found in list.');
    }
};

run();
