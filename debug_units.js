
async function check() {
    console.log("Fetching data for Quincy, MA...");
    // 42.2529, -71.0023
    const lat = 42.2529;
    const lon = -71.0023;

    // Matches the params in api.ts
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&timezone=GMT&past_days=1&forecast_days=3&precipitation_unit=mm&hourly=precipitation,rain,showers,snowfall,weather_code`;

    try {
        const res = await fetch(url);
        const data = await res.json();
        const hourly = data.hourly;

        console.log("UNIT CHECK:");
        console.log("Precip Unit:", data.hourly_units?.precipitation);
        console.log("Snowfall Unit:", data.hourly_units?.snowfall); // CRITICAL CHECK

        console.log("\nDATA SAMPLE (First 5 hours with snow):");
        let found = 0;
        for (let i = 0; i < hourly.time.length; i++) {
            const s = hourly.snowfall[i];
            const p = hourly.precipitation[i];
            if (s > 0 || p > 0) {
                console.log(`Time: ${hourly.time[i]} | Precip (Liquid): ${p} | Snowfall: ${s}`);
                found++;
                if (found > 10) break;
            }
        }
    } catch (e) {
        console.error(e);
    }
}

check();
