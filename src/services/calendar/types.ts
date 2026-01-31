export interface CalendarEvent {
    id: string;
    summary: string;
    description?: string;
    location?: string; // New: Event Location
    start: Date;
    end: Date;
}

export interface CalendarProvider {
    /**
     * Checks if the provider is authenticated/ready.
     */
    isAuthenticated(): boolean;

    /**
     * Ensures the "Ideal Time" calendar exists.
     * @returns The calendar ID of "The Ideal Time" calendar.
     */
    ensureCalendar(): Promise<string>;

    /**
     * Fetches events from the "Ideal Time" calendar for a given range.
     */
    getEvents(calendarId: string, start: Date, end: Date): Promise<CalendarEvent[]>;

    /**
     * Creates an event in the specified calendar.
     */
    createEvent(calendarId: string, event: Omit<CalendarEvent, 'id'>): Promise<string>;

    /**
     * Deletes an event.
     */
    deleteEvent(calendarId: string, eventId: string): Promise<void>;
}
