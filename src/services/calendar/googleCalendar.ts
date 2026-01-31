import type { CalendarEvent, CalendarProvider } from './types';

const API_BASE = 'https://www.googleapis.com/calendar/v3';
const CALENDAR_NAME = 'The Ideal Time';

export class GoogleCalendarService implements CalendarProvider {
    private accessToken: string | null = null;

    constructor(token: string) {
        this.accessToken = token;
    }

    isAuthenticated(): boolean {
        return !!this.accessToken;
    }

    private async fetch(endpoint: string, options: RequestInit = {}) {
        if (!this.accessToken) throw new Error('Not authenticated');

        const res = await fetch(`${API_BASE}${endpoint}`, {
            ...options,
            headers: {
                ...options.headers,
                'Authorization': `Bearer ${this.accessToken}`,
                'Content-Type': 'application/json'
            }
        });

        if (!res.ok) {
            const error = await res.json();
            throw new Error(error.error?.message || 'Calendar API Error');
        }

        if (res.status === 204) {
            return null;
        }

        return res.json();
    }

    async ensureCalendar(): Promise<string> {
        // 1. List calendars to find existing one
        const data = await this.fetch('/users/me/calendarList');
        const existing = data.items.find((c: any) => c.summary === CALENDAR_NAME);

        if (existing) {
            return existing.id;
        }

        // 2. Create if not found
        // Note: 'calendars' endpoint creates a secondary calendar
        const newCal = await this.fetch('/calendars', {
            method: 'POST',
            body: JSON.stringify({ summary: CALENDAR_NAME })
        });

        return newCal.id;
    }

    async getEvents(calendarId: string, start: Date, end: Date): Promise<CalendarEvent[]> {
        const params = new URLSearchParams({
            timeMin: start.toISOString(),
            timeMax: end.toISOString(),
            singleEvents: 'true',
            orderBy: 'startTime'
        });

        const data = await this.fetch(`/calendars/${calendarId}/events?${params}`);

        return data.items.map((item: any) => ({
            id: item.id,
            summary: item.summary,
            description: item.description,
            start: new Date(item.start.dateTime || item.start.date),
            end: new Date(item.end.dateTime || item.end.date)
        }));
    }

    async createEvent(calendarId: string, event: Omit<CalendarEvent, 'id'>): Promise<string> {
        const body = {
            summary: event.summary,
            description: event.description,
            location: event.location, // Add Location
            start: { dateTime: event.start.toISOString() },
            end: { dateTime: event.end.toISOString() }
        };

        const res = await this.fetch(`/calendars/${calendarId}/events`, {
            method: 'POST',
            body: JSON.stringify(body)
        });

        return res.id;
    }

    async deleteEvent(calendarId: string, eventId: string): Promise<void> {
        await this.fetch(`/calendars/${calendarId}/events/${eventId}`, {
            method: 'DELETE'
        });
    }
}
