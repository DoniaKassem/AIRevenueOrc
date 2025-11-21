/**
 * Meeting Scheduler with Calendar Integration
 * Handles automatic meeting scheduling with Google Calendar, Outlook, and more
 */

import { supabase } from '../supabase';
import { routeAIRequest } from '../ai/modelRouter';

export interface CalendarProvider {
  type: 'google' | 'outlook' | 'office365' | 'apple';
  accessToken: string;
  refreshToken: string;
  email: string;
  expiresAt: string;
}

export interface AvailabilitySlot {
  start: Date;
  end: Date;
  duration: number;  // minutes
  timezone: string;
}

export interface MeetingRequest {
  prospectId: string;
  title: string;
  description: string;
  duration: number;           // minutes
  attendees: string[];        // email addresses
  preferredTimes?: Date[];    // Prospect's preferred times
  location?: string;          // Physical address or video link
  meetingType: 'discovery' | 'demo' | 'follow_up' | 'close' | 'other';
}

export interface ScheduledMeeting {
  id: string;
  prospectId: string;
  calendarEventId: string;
  title: string;
  description: string;
  startTime: Date;
  endTime: Date;
  duration: number;
  attendees: string[];
  organizer: string;
  location: string;
  meetingLink?: string;       // Zoom/Teams/Meet link
  status: 'scheduled' | 'completed' | 'cancelled' | 'no_show';
  reminders: {
    twentyFourHours: boolean;
    oneHour: boolean;
  };
  createdAt: string;
}

export interface AvailabilityPreferences {
  workingHours: {
    start: number;  // Hour (0-23)
    end: number;    // Hour (0-23)
  };
  workingDays: number[];  // 0-6 (Sunday-Saturday)
  timezone: string;
  bufferBefore: number;   // minutes
  bufferAfter: number;    // minutes
  minNoticePeriod: number; // hours
  maxBookingWindow: number; // days
  meetingDurations: number[]; // Available durations
}

/**
 * Default availability preferences
 */
const DEFAULT_PREFERENCES: AvailabilityPreferences = {
  workingHours: { start: 9, end: 17 },
  workingDays: [1, 2, 3, 4, 5], // Mon-Fri
  timezone: 'America/New_York',
  bufferBefore: 15,
  bufferAfter: 15,
  minNoticePeriod: 2, // 2 hours
  maxBookingWindow: 30, // 30 days
  meetingDurations: [15, 30, 45, 60],
};

/**
 * Meeting scheduler class
 */
export class MeetingScheduler {
  private teamId: string;
  private userId: string;
  private preferences: AvailabilityPreferences;

  constructor(
    teamId: string,
    userId: string,
    preferences?: Partial<AvailabilityPreferences>
  ) {
    this.teamId = teamId;
    this.userId = userId;
    this.preferences = { ...DEFAULT_PREFERENCES, ...preferences };
  }

  /**
   * Get available time slots
   */
  async getAvailableSlots(
    durationMinutes: number,
    daysAhead: number = 14
  ): Promise<AvailabilitySlot[]> {
    const now = new Date();
    const minStart = new Date(now.getTime() + this.preferences.minNoticePeriod * 60 * 60 * 1000);
    const maxEnd = new Date(now.getTime() + Math.min(daysAhead, this.preferences.maxBookingWindow) * 24 * 60 * 60 * 1000);

    // Get existing meetings from calendar
    const existingMeetings = await this.getExistingMeetings(minStart, maxEnd);

    // Generate candidate slots
    const slots: AvailabilitySlot[] = [];
    const currentDate = new Date(minStart);

    while (currentDate < maxEnd) {
      const dayOfWeek = currentDate.getDay();

      // Skip if not a working day
      if (!this.preferences.workingDays.includes(dayOfWeek)) {
        currentDate.setDate(currentDate.getDate() + 1);
        currentDate.setHours(this.preferences.workingHours.start, 0, 0, 0);
        continue;
      }

      // Generate slots for this day
      for (let hour = this.preferences.workingHours.start; hour < this.preferences.workingHours.end; hour++) {
        for (let minute = 0; minute < 60; minute += 15) {
          const slotStart = new Date(currentDate);
          slotStart.setHours(hour, minute, 0, 0);

          const slotEnd = new Date(slotStart.getTime() + durationMinutes * 60 * 1000);

          // Check if slot is within working hours
          if (slotEnd.getHours() > this.preferences.workingHours.end) {
            break;
          }

          // Check if slot is available (no conflicts with existing meetings)
          const isAvailable = !existingMeetings.some(meeting =>
            this.hasTimeConflict(slotStart, slotEnd, meeting.startTime, meeting.endTime)
          );

          if (isAvailable) {
            slots.push({
              start: slotStart,
              end: slotEnd,
              duration: durationMinutes,
              timezone: this.preferences.timezone,
            });
          }
        }
      }

      // Move to next day
      currentDate.setDate(currentDate.getDate() + 1);
      currentDate.setHours(this.preferences.workingHours.start, 0, 0, 0);
    }

    return slots;
  }

  /**
   * Schedule a meeting
   */
  async scheduleMeeting(request: MeetingRequest): Promise<ScheduledMeeting> {
    // Find best available slot
    let selectedSlot: AvailabilitySlot;

    if (request.preferredTimes && request.preferredTimes.length > 0) {
      // Try to match one of the preferred times
      const availableSlots = await this.getAvailableSlots(request.duration);
      selectedSlot = this.findBestMatchingSlot(availableSlots, request.preferredTimes) || availableSlots[0];
    } else {
      // Get next available slot
      const availableSlots = await this.getAvailableSlots(request.duration);
      if (availableSlots.length === 0) {
        throw new Error('No available slots found');
      }
      selectedSlot = availableSlots[0];
    }

    // Get calendar provider
    const calendar = await this.getCalendarProvider();

    // Generate meeting link (Zoom, Teams, or Google Meet)
    const meetingLink = await this.generateMeetingLink(request.meetingType);

    // Create calendar event
    const calendarEventId = await this.createCalendarEvent(calendar, {
      title: request.title,
      description: request.description,
      start: selectedSlot.start,
      end: selectedSlot.end,
      attendees: request.attendees,
      location: meetingLink || request.location,
    });

    // Store in database
    const meeting: ScheduledMeeting = {
      id: `meeting_${Date.now()}`,
      prospectId: request.prospectId,
      calendarEventId,
      title: request.title,
      description: request.description,
      startTime: selectedSlot.start,
      endTime: selectedSlot.end,
      duration: request.duration,
      attendees: request.attendees,
      organizer: calendar.email,
      location: request.location || '',
      meetingLink,
      status: 'scheduled',
      reminders: {
        twentyFourHours: true,
        oneHour: true,
      },
      createdAt: new Date().toISOString(),
    };

    await supabase.from('scheduled_meetings').insert({
      team_id: this.teamId,
      prospect_id: request.prospectId,
      calendar_event_id: calendarEventId,
      title: request.title,
      description: request.description,
      start_time: selectedSlot.start.toISOString(),
      end_time: selectedSlot.end.toISOString(),
      duration: request.duration,
      attendees: request.attendees,
      organizer: calendar.email,
      location: request.location,
      meeting_link: meetingLink,
      meeting_type: request.meetingType,
      status: 'scheduled',
      created_at: meeting.createdAt,
    });

    // Schedule reminders
    await this.scheduleReminders(meeting);

    // Log activity
    await this.logMeetingActivity(request.prospectId, 'meeting_scheduled', meeting);

    return meeting;
  }

  /**
   * Parse natural language meeting request
   */
  async parseNaturalLanguageRequest(
    message: string,
    prospectId: string
  ): Promise<MeetingRequest | null> {
    const prompt = `Parse this meeting request from a prospect:

"${message}"

Extract:
1. Preferred dates/times (if mentioned)
2. Duration preference (default to 30 minutes if not mentioned)
3. Meeting type (discovery, demo, follow_up, etc.)
4. Any special requirements

Return JSON:
{
  "preferredTimes": ["ISO date strings"],
  "duration": number,
  "meetingType": "discovery|demo|follow_up|close|other",
  "notes": "any special requirements"
}

If no clear meeting request found, return null.`;

    const response = await routeAIRequest(prompt, {
      taskType: 'text-analysis',
      maxTokens: 300,
    });

    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return null;

      const parsed = JSON.parse(jsonMatch[0]);

      return {
        prospectId,
        title: `Meeting with Prospect`,
        description: `Meeting scheduled via automatic booking.\n\nNotes: ${parsed.notes || 'None'}`,
        duration: parsed.duration || 30,
        attendees: [],
        preferredTimes: parsed.preferredTimes?.map((t: string) => new Date(t)) || [],
        meetingType: parsed.meetingType || 'discovery',
      };
    } catch (error) {
      console.error('Failed to parse meeting request:', error);
      return null;
    }
  }

  /**
   * Cancel a meeting
   */
  async cancelMeeting(
    meetingId: string,
    reason?: string,
    notifyAttendees: boolean = true
  ): Promise<void> {
    // Get meeting details
    const { data: meeting } = await supabase
      .from('scheduled_meetings')
      .select('*')
      .eq('id', meetingId)
      .single();

    if (!meeting) {
      throw new Error('Meeting not found');
    }

    // Cancel calendar event
    const calendar = await this.getCalendarProvider();
    await this.cancelCalendarEvent(calendar, meeting.calendar_event_id, notifyAttendees);

    // Update database
    await supabase
      .from('scheduled_meetings')
      .update({
        status: 'cancelled',
        cancellation_reason: reason,
        cancelled_at: new Date().toISOString(),
      })
      .eq('id', meetingId);

    // Log activity
    await this.logMeetingActivity(meeting.prospect_id, 'meeting_cancelled', { reason });
  }

  /**
   * Reschedule a meeting
   */
  async rescheduleMeeting(
    meetingId: string,
    newStartTime: Date,
    newDuration?: number
  ): Promise<ScheduledMeeting> {
    // Get existing meeting
    const { data: existing } = await supabase
      .from('scheduled_meetings')
      .select('*')
      .eq('id', meetingId)
      .single();

    if (!existing) {
      throw new Error('Meeting not found');
    }

    // Cancel old meeting
    await this.cancelMeeting(meetingId, 'Rescheduled', false);

    // Create new meeting
    return await this.scheduleMeeting({
      prospectId: existing.prospect_id,
      title: existing.title,
      description: `${existing.description}\n\n[Rescheduled from ${new Date(existing.start_time).toLocaleString()}]`,
      duration: newDuration || existing.duration,
      attendees: existing.attendees,
      preferredTimes: [newStartTime],
      meetingType: existing.meeting_type,
    });
  }

  /**
   * Send meeting reminder
   */
  async sendReminder(
    meetingId: string,
    reminderType: '24h' | '1h' | 'custom',
    customMessage?: string
  ): Promise<void> {
    const { data: meeting } = await supabase
      .from('scheduled_meetings')
      .select('*, prospects(*)')
      .eq('id', meetingId)
      .single();

    if (!meeting) return;

    const timeUntil = new Date(meeting.start_time).getTime() - Date.now();
    const hoursUntil = Math.round(timeUntil / (1000 * 60 * 60));

    let message = customMessage;
    if (!message) {
      if (reminderType === '24h') {
        message = `Reminder: You have a meeting tomorrow at ${new Date(meeting.start_time).toLocaleTimeString()}`;
      } else if (reminderType === '1h') {
        message = `Reminder: Your meeting starts in 1 hour`;
      }
    }

    // Send reminder email
    // (In production, integrate with email service)
    console.log(`[Meeting] Reminder sent for meeting ${meetingId}: ${message}`);

    // Log activity
    await this.logMeetingActivity(meeting.prospect_id, 'reminder_sent', {
      reminderType,
      hoursUntil,
    });
  }

  /**
   * Mark meeting as completed
   */
  async completeMeeting(meetingId: string, notes?: string): Promise<void> {
    await supabase
      .from('scheduled_meetings')
      .update({
        status: 'completed',
        completion_notes: notes,
        completed_at: new Date().toISOString(),
      })
      .eq('id', meetingId);

    const { data: meeting } = await supabase
      .from('scheduled_meetings')
      .select('prospect_id')
      .eq('id', meetingId)
      .single();

    if (meeting) {
      await this.logMeetingActivity(meeting.prospect_id, 'meeting_completed', { notes });
    }
  }

  /**
   * Mark prospect as no-show
   */
  async markNoShow(meetingId: string): Promise<void> {
    await supabase
      .from('scheduled_meetings')
      .update({
        status: 'no_show',
        no_show_at: new Date().toISOString(),
      })
      .eq('id', meetingId);

    const { data: meeting } = await supabase
      .from('scheduled_meetings')
      .select('prospect_id')
      .eq('id', meetingId)
      .single();

    if (meeting) {
      await this.logMeetingActivity(meeting.prospect_id, 'meeting_no_show', {});
    }
  }

  /**
   * Generate booking link (like Calendly)
   */
  async generateBookingLink(
    duration: number = 30,
    meetingType: string = 'discovery'
  ): Promise<string> {
    // In production, this would generate a unique shareable link
    // that prospects can use to self-book meetings

    const token = `booking_${this.userId}_${Date.now()}`;
    const baseUrl = 'https://app.example.com/book';

    return `${baseUrl}/${token}?duration=${duration}&type=${meetingType}`;
  }

  // Private helper methods

  private async getExistingMeetings(start: Date, end: Date): Promise<ScheduledMeeting[]> {
    const { data } = await supabase
      .from('scheduled_meetings')
      .select('*')
      .eq('team_id', this.teamId)
      .gte('start_time', start.toISOString())
      .lte('end_time', end.toISOString())
      .eq('status', 'scheduled');

    return (data || []).map(m => ({
      ...m,
      startTime: new Date(m.start_time),
      endTime: new Date(m.end_time),
    }));
  }

  private hasTimeConflict(
    start1: Date,
    end1: Date,
    start2: Date,
    end2: Date
  ): boolean {
    // Add buffer time
    const bufferedStart1 = new Date(start1.getTime() - this.preferences.bufferBefore * 60 * 1000);
    const bufferedEnd1 = new Date(end1.getTime() + this.preferences.bufferAfter * 60 * 1000);

    return bufferedStart1 < end2 && bufferedEnd1 > start2;
  }

  private findBestMatchingSlot(
    availableSlots: AvailabilitySlot[],
    preferredTimes: Date[]
  ): AvailabilitySlot | null {
    let bestSlot: AvailabilitySlot | null = null;
    let smallestDiff = Infinity;

    for (const slot of availableSlots) {
      for (const preferred of preferredTimes) {
        const diff = Math.abs(slot.start.getTime() - preferred.getTime());
        if (diff < smallestDiff) {
          smallestDiff = diff;
          bestSlot = slot;
        }
      }
    }

    return bestSlot;
  }

  private async getCalendarProvider(): Promise<CalendarProvider> {
    const { data } = await supabase
      .from('calendar_integrations')
      .select('*')
      .eq('user_id', this.userId)
      .single();

    if (!data) {
      throw new Error('No calendar integration found');
    }

    return data as CalendarProvider;
  }

  private async createCalendarEvent(
    calendar: CalendarProvider,
    event: {
      title: string;
      description: string;
      start: Date;
      end: Date;
      attendees: string[];
      location?: string;
    }
  ): Promise<string> {
    // In production, integrate with actual calendar APIs
    // Google Calendar API, Microsoft Graph API, etc.

    if (calendar.type === 'google') {
      return await this.createGoogleCalendarEvent(calendar, event);
    } else if (calendar.type === 'outlook' || calendar.type === 'office365') {
      return await this.createOutlookCalendarEvent(calendar, event);
    }

    throw new Error(`Unsupported calendar type: ${calendar.type}`);
  }

  private async createGoogleCalendarEvent(
    calendar: CalendarProvider,
    event: any
  ): Promise<string> {
    // Mock Google Calendar API integration
    console.log(`[Google Calendar] Creating event: ${event.title}`);
    return `google_event_${Date.now()}`;
  }

  private async createOutlookCalendarEvent(
    calendar: CalendarProvider,
    event: any
  ): Promise<string> {
    // Mock Outlook Calendar API integration
    console.log(`[Outlook Calendar] Creating event: ${event.title}`);
    return `outlook_event_${Date.now()}`;
  }

  private async cancelCalendarEvent(
    calendar: CalendarProvider,
    eventId: string,
    notifyAttendees: boolean
  ): Promise<void> {
    console.log(`[Calendar] Cancelling event ${eventId}, notify: ${notifyAttendees}`);
  }

  private async generateMeetingLink(meetingType: string): Promise<string> {
    // In production, integrate with Zoom, Teams, or Google Meet API
    // to generate meeting links automatically

    const providers = ['zoom', 'teams', 'meet'];
    const provider = providers[0]; // Default to Zoom

    return `https://${provider}.example.com/j/${Date.now()}`;
  }

  private async scheduleReminders(meeting: ScheduledMeeting): Promise<void> {
    // Schedule 24-hour reminder
    if (meeting.reminders.twentyFourHours) {
      const reminderTime = new Date(meeting.startTime.getTime() - 24 * 60 * 60 * 1000);
      // In production, use a job scheduler like Bull or Agenda
      console.log(`[Reminder] Scheduled 24h reminder for ${meeting.id} at ${reminderTime}`);
    }

    // Schedule 1-hour reminder
    if (meeting.reminders.oneHour) {
      const reminderTime = new Date(meeting.startTime.getTime() - 60 * 60 * 1000);
      console.log(`[Reminder] Scheduled 1h reminder for ${meeting.id} at ${reminderTime}`);
    }
  }

  private async logMeetingActivity(
    prospectId: string,
    activityType: string,
    details: any
  ): Promise<void> {
    await supabase.from('bdr_activities').insert({
      team_id: this.teamId,
      prospect_id: prospectId,
      activity_type: activityType,
      channel: 'system',
      direction: 'internal',
      metadata: details,
      was_automated: true,
    });
  }
}

/**
 * Get upcoming meetings
 */
export async function getUpcomingMeetings(
  teamId: string,
  daysAhead: number = 7
): Promise<ScheduledMeeting[]> {
  const now = new Date();
  const future = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);

  const { data } = await supabase
    .from('scheduled_meetings')
    .select('*')
    .eq('team_id', teamId)
    .eq('status', 'scheduled')
    .gte('start_time', now.toISOString())
    .lte('start_time', future.toISOString())
    .order('start_time', { ascending: true });

  return (data || []).map(m => ({
    ...m,
    startTime: new Date(m.start_time),
    endTime: new Date(m.end_time),
  }));
}

/**
 * Get meeting statistics
 */
export async function getMeetingStats(
  teamId: string,
  daysBack: number = 30
): Promise<{
  totalScheduled: number;
  totalCompleted: number;
  totalCancelled: number;
  totalNoShows: number;
  completionRate: number;
  noShowRate: number;
  averageDuration: number;
}> {
  const since = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000);

  const { data: meetings } = await supabase
    .from('scheduled_meetings')
    .select('status, duration')
    .eq('team_id', teamId)
    .gte('created_at', since.toISOString());

  const totalScheduled = meetings?.length || 0;
  const totalCompleted = meetings?.filter(m => m.status === 'completed').length || 0;
  const totalCancelled = meetings?.filter(m => m.status === 'cancelled').length || 0;
  const totalNoShows = meetings?.filter(m => m.status === 'no_show').length || 0;

  const averageDuration = meetings && meetings.length > 0
    ? meetings.reduce((sum, m) => sum + m.duration, 0) / meetings.length
    : 0;

  return {
    totalScheduled,
    totalCompleted,
    totalCancelled,
    totalNoShows,
    completionRate: totalScheduled > 0 ? (totalCompleted / totalScheduled) * 100 : 0,
    noShowRate: totalScheduled > 0 ? (totalNoShows / totalScheduled) * 100 : 0,
    averageDuration,
  };
}
