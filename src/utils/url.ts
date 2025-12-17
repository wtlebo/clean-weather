import type { AppSettings } from '../types/settings';
import { DEFAULT_SETTINGS } from '../types/settings';
import type { LocationResult } from '../services/api';

// Helper to compact booleans into a single character string
// e.g. [true, false, true] -> "101" (or encoded hex/base64 if needed, but simple 1/0 string is readable enough)
// Actually, let's use single letters for active flags to keep it short?
// Or just "101".
const boolsToHex = (...bools: boolean[]) => {
    let val = 0;
    bools.forEach((b, i) => {
        if (b) val |= (1 << i);
    });
    return val.toString(16);
};

const hexToBools = (hex: string, count: number): boolean[] => {
    const val = parseInt(hex, 16);
    if (isNaN(val)) return new Array(count).fill(false);

    const bools = [];
    for (let i = 0; i < count; i++) {
        bools.push(!!(val & (1 << i)));
    }
    return bools;
};

export const serializeSettings = (settings: AppSettings): URLSearchParams => {
    const params = new URLSearchParams();

    // Units
    if (settings.units !== DEFAULT_SETTINGS.units) {
        params.set('u', settings.units === 'metric' ? 'm' : 'i');
    }

    // Chart Order & Visibility
    // Format: "temp,wind,!uv" (visible, visible, hidden) 
    // OR just list visible ones? If we list visible ones, how do we know order of hidden ones?
    // We only care about visible ones mostly.
    // Let's store comma separated IDs of VISIBLE charts in ORDER.
    const visibleCharts = settings.chartOrder
        .filter(c => c.visible)
        .map(c => c.id)
        .join(',');
    params.set('charts', visibleCharts);

    // Temp Options
    // bit 0: feelsLike, bit 1: dewPoint, bit 2: dailyHighLow
    const tempHex = boolsToHex(
        settings.temp.showFeelsLike,
        settings.temp.showDewPoint,
        settings.temp.showDailyHighLow
    );
    if (tempHex !== boolsToHex(DEFAULT_SETTINGS.temp.showFeelsLike, DEFAULT_SETTINGS.temp.showDewPoint, DEFAULT_SETTINGS.temp.showDailyHighLow)) {
        params.set('t_opt', tempHex);
    }

    // Precip Options
    // bit 0: humidity, bit 1: amount, bit 2: thunder, bit 3: accumulation
    const precipHex = boolsToHex(
        settings.precip.showHumidity,
        settings.precip.showAmount,
        settings.precip.showThunder,
        settings.precip.showAccumulation
    );
    if (precipHex !== boolsToHex(
        DEFAULT_SETTINGS.precip.showHumidity,
        DEFAULT_SETTINGS.precip.showAmount,
        DEFAULT_SETTINGS.precip.showThunder,
        DEFAULT_SETTINGS.precip.showAccumulation
    )) {
        params.set('p_opt', precipHex);
    }

    // Wind Options
    // bit 0: dailyHigh
    const windHex = boolsToHex(settings.wind.showDailyHigh);
    if (windHex !== boolsToHex(DEFAULT_SETTINGS.wind.showDailyHigh)) {
        params.set('w_opt', windHex);
    }

    return params;
};

export const parseSettings = (params: URLSearchParams): AppSettings => {
    const s = { ...DEFAULT_SETTINGS };

    // Units
    const u = params.get('u');
    if (u === 'm') s.units = 'metric';
    else if (u === 'i') s.units = 'imperial';

    // Charts
    const charts = params.get('charts');
    if (charts) {
        const visibleIds = new Set(charts.split(','));
        // Reorder: active ones first in order, then hidden ones
        const newOrder: typeof DEFAULT_SETTINGS.chartOrder = [];
        // First add the ones in the param list
        charts.split(',').forEach(id => {
            const def = DEFAULT_SETTINGS.chartOrder.find(c => c.id === id);
            if (def) {
                newOrder.push({ ...def, visible: true });
            }
        });
        // Then add remaining hidden ones
        DEFAULT_SETTINGS.chartOrder.forEach(def => {
            if (!visibleIds.has(def.id)) {
                newOrder.push({ ...def, visible: false });
            }
        });
        s.chartOrder = newOrder;
    }

    // Temp Options
    const t_opt = params.get('t_opt');
    if (t_opt) {
        const [feels, dew, highLow] = hexToBools(t_opt, 3);
        s.temp = { showFeelsLike: feels, showDewPoint: dew, showDailyHighLow: highLow };
    }

    // Precip Options
    const p_opt = params.get('p_opt');
    if (p_opt) {
        const [hum, amt, thunder, accum] = hexToBools(p_opt, 4);
        s.precip = { showHumidity: hum, showAmount: amt, showThunder: thunder, showAccumulation: accum };
    }

    // Wind Options
    const w_opt = params.get('w_opt');
    if (w_opt) {
        const [dailyHigh] = hexToBools(w_opt, 1);
        s.wind = { showDailyHigh: dailyHigh };
    }

    return s;
};

// Robust deep merge for settings
export const mergeSettings = (saved: any): AppSettings => {
    if (!saved) return { ...DEFAULT_SETTINGS };

    const final = { ...DEFAULT_SETTINGS };

    if (saved.units) final.units = saved.units;

    // Sanitize Chart Order to remove deleted charts (e.g. historical)
    if (saved.chartOrder && Array.isArray(saved.chartOrder)) {
        const validIds = new Set(DEFAULT_SETTINGS.chartOrder.map(c => c.id));

        // 1. Keep only valid saved charts
        const cleanSaved = saved.chartOrder.filter((c: any) => validIds.has(c.id));

        // 2. Add any missing default charts
        const savedIds = new Set(cleanSaved.map((c: any) => c.id));
        const missing = DEFAULT_SETTINGS.chartOrder.filter(c => !savedIds.has(c.id));

        final.chartOrder = [...cleanSaved, ...missing];
    }

    if (saved.temp) final.temp = { ...DEFAULT_SETTINGS.temp, ...saved.temp };
    if (saved.wind) final.wind = { ...DEFAULT_SETTINGS.wind, ...saved.wind };
    if (saved.precip) final.precip = { ...DEFAULT_SETTINGS.precip, ...saved.precip };
    if (saved.tide) final.tide = { ...DEFAULT_SETTINGS.tide, ...saved.tide };

    if (saved.waterTemp) final.waterTemp = { ...DEFAULT_SETTINGS.waterTemp, ...saved.waterTemp };

    return final;
};

export const serializeLocation = (loc: LocationResult): URLSearchParams => {
    const params = new URLSearchParams();
    params.set('id', loc.id.toString());
    params.set('name', loc.name);
    params.set('lat', loc.latitude.toFixed(5));
    params.set('lon', loc.longitude.toFixed(5));
    params.set('tz', loc.timezone);
    if (loc.country_code) params.set('cc', loc.country_code);
    return params;
};

export const parseLocation = (params: URLSearchParams): LocationResult | null => {
    const id = params.get('id');
    const name = params.get('name');
    const lat = params.get('lat');
    const lon = params.get('lon');
    const tz = params.get('tz');

    if (id && name && lat && lon && tz) {
        return {
            id: parseInt(id),
            name,
            latitude: parseFloat(lat),
            longitude: parseFloat(lon),
            timezone: tz,
            elevation: 0, // Not passed, acceptable default
            country_code: params.get('cc') || ''
        };
    }
    return null;
};
