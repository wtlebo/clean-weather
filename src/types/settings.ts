export interface ChartSettings {
    id: string;
    label: string;
    visible: boolean;
}

export interface AppSettings {
    units: 'imperial' | 'metric';
    chartOrder: ChartSettings[];
    // Specific chart options
    temp: {
        showFeelsLike: boolean;
        showDewPoint: boolean;
        showDailyHighLow: boolean;
    };
    wind: {
        showDailyHigh: boolean;
    };
    precip: {
        showHumidity: boolean;
        showAmount: boolean;
        showThunder: boolean;
        showAccumulation: boolean;
    };
    tide: {
        showHighLow: boolean;
    };
    marine: {
        showChart: boolean;
    };
    waterTemp: {
        showChart: boolean;
    };
}

export const DEFAULT_SETTINGS: AppSettings = {
    units: 'imperial',

    temp: {
        showFeelsLike: true,
        showDewPoint: false,
        showDailyHighLow: true,
    },
    wind: {
        showDailyHigh: true,
    },
    precip: {
        showHumidity: true,
        showAmount: true,
        showThunder: true,
        showAccumulation: true,
    },
    tide: {
        showHighLow: true,
    },
    marine: {
        showChart: false,
    },
    waterTemp: {
        showChart: true,
    },
    chartOrder: [
        { id: 'temperature', visible: true, label: 'Temperature' },
        { id: 'precipitation', visible: true, label: 'Precipitation' },
        { id: 'wind', visible: true, label: 'Wind' },
        { id: 'sky', visible: true, label: 'Sky Cover' },
        { id: 'tide', visible: true, label: 'Tides' },
        { id: 'moon', visible: true, label: 'Moon Phase' },
        { id: 'marine', visible: false, label: 'Marine / Surf' },
        { id: 'waterTemp', visible: false, label: 'Water Temp' },
        { id: 'aqi', visible: false, label: 'Air Quality' },
        { id: 'uv', visible: false, label: 'UV Index' },
    ],

};
