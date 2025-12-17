
// Native fetch in Node 18+

const NOAA_API_BASE = 'https://api.tidesandcurrents.noaa.gov/api/prod/datagetter';
const STATIONS_URL = 'https://api.tidesandcurrents.noaa.gov/mdapi/prod/webapi/stations.json?type=tidepredictions';

// Quincy, MA
const LAT = 42.25;
const LON = -71.00;

// Haversine
const getDistanceFromLatLonInMiles = (lat1, lon1, lat2, lon2) => {
    const R = 3959;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

async function run() {
    console.log(`Checking Tides for Lat: ${LAT}, Lon: ${LON}`);

    // 1. Find Station
    console.log('Fetching stations...');
    const sRes = await fetch(STATIONS_URL);
    const sData = await sRes.json();

    let nearest = null;
    let minDist = Infinity;

    for (const s of sData.stations) {
        const d = getDistanceFromLatLonInMiles(LAT, LON, s.lat, s.lng);
        if (d < minDist) {
            minDist = d;
            nearest = s;
        }
    }

    if (!nearest) {
        console.log('No station found.');
        return;
    }

    console.log(`Nearest Station: ${nearest.name} (ID: ${nearest.id}) - ${minDist.toFixed(2)} miles away`);

    // 2. Fetch Datums
    console.log('Fetching Datums (metric)...');
    const dRes = await fetch(`https://api.tidesandcurrents.noaa.gov/mdapi/prod/webapi/stations/${nearest.id}/datums.json?units=metric`);
    const dData = await dRes.json();

    // Check available datums
    // console.log('Available Datums:', dData.datums.map(d => d.name));

    const HAT = dData.HAT;
    const MLLW = dData.datums.find(d => d.name === 'MLLW')?.value;
    const MHHW = dData.datums.find(d => d.name === 'MHHW')?.value;

    console.log('--- DATUMS (Metric) ---');
    console.log('HAT (Station Datum):', HAT);
    console.log('MLLW (Station Datum):', MLLW);
    console.log('MHHW (Station Datum):', MHHW);

    let alertThreshold = null;
    if (HAT !== undefined && MLLW !== undefined) {
        // App Logic: Chart uses MLLW. So we need HAT relative to MLLW.
        const hatRelMllw = HAT - MLLW;
        console.log(`\nHAT relative to MLLW: ${hatRelMllw.toFixed(3)} meters`);
        console.log(`(In Feet: ${(hatRelMllw * 3.28084).toFixed(2)} ft)`);

        alertThreshold = hatRelMllw - 0.15; // The buffer we used
        console.log(`Current App Threshold (HAT - 0.15m): ${alertThreshold.toFixed(3)} meters`);
        console.log(`(In Feet: ${(alertThreshold * 3.28084).toFixed(2)} ft)`);
    }

    // 3. Fetch Predictions (Next 5 Days)
    console.log('\nFetching Predictions (next 5 days)...');
    const start = new Date();
    const end = new Date();
    end.setDate(end.getDate() + 5);

    const formatDate = (d) => d.toISOString().slice(0, 10).replace(/-/g, '');

    const pUrl = `${NOAA_API_BASE}?product=predictions&application=TechTest&begin_date=${formatDate(start)}&end_date=${formatDate(end)}&datum=MLLW&station=${nearest.id}&time_zone=gmt&units=metric&interval=h&format=json`;

    const pRes = await fetch(pUrl);
    const pData = await pRes.json();

    const predictions = pData.predictions.map(p => parseFloat(p.v));
    const maxPred = Math.max(...predictions);

    console.log(`\nMax Prediction in next 5 days: ${maxPred.toFixed(3)} m`);
    console.log(`(In Feet: ${(maxPred * 3.28084).toFixed(2)} ft)`);

    // List all peaks
    console.log('\n--- High Tide Peaks (Next 5 Days) ---');
    for (let i = 1; i < predictions.length - 1; i++) {
        const prev = predictions[i - 1];
        const curr = predictions[i];
        const next = predictions[i + 1];

        if (curr > prev && curr > next) {
            const t = pData.predictions[i].t;
            console.log(`${t}: ${curr.toFixed(3)} m (${(curr * 3.28084).toFixed(2)} ft)`);
        }
    }

    if (alertThreshold) {
        console.log(`\nIs Max > Threshold? ${maxPred >= alertThreshold ? 'YES (Red)' : 'NO (Blue)'}`);
        console.log(`Is Max > HAT (Strict)? ${maxPred >= (HAT - MLLW) ? 'YES (Record)' : 'NO'}`);
    }
}

run();
