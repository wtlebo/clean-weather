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
    };
    precip: {
        showHumidity: boolean;
        showAmount: boolean;
        showThunder: boolean;
    };
}

export const DEFAULT_SETTINGS: AppSettings = {
    units: 'imperial',
    chartOrder: [
        { id: 'temp', label: 'Temperature', visible: true },
        { id: 'precip', label: 'Precipitation', visible: true },
        { id: 'wind', label: 'Wind', visible: true },
        { id: 'sky', label: 'Sky Cover', visible: true },
        { id: 'aqi', label: 'Air Quality', visible: false },
        { id: 'uv', label: 'UV Index', visible: false },
        { id: 'tide', label: 'Tides', visible: false },
    ],
    temp: {
        showFeelsLike: true,
        showDewPoint: false,
    },
    precip: {
        showHumidity: true,
        showAmount: true,
        showThunder: true,
    },
};
