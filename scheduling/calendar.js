import { supabase } from '../lib/supabase';
import moment from 'moment';

/**************************************************************
 * DATABASE FUNCTIONS
**************************************************************/

/**
 * Function to fetch user events from database
*/
async function fetchUserSessions(userId) {
  try {
    const { data, error } = await supabase
      .from('sessions')
      .select('*')
      .or(`student_id.eq.${userId},tutor_id.eq.${userId}`)
      .order('session_date', { ascending: true })
      .order('start_time', { ascending: true });

    if (error) throw error;
    return data;
  } catch (err) {
    console.error('Error fetching sessions:', err);
    return [];
  }
}

/**
 * Fetches the most overdue session from the database.
 */
async function fetchMostOverdueSession() {
  try {
    const { data, error } = await supabase
      .from('sessions')
      .select('*')
      .lt('session_date', moment().format('YYYY-MM-DD')) // Filter for sessions before today
      .order('session_date', { ascending: true }) // Sort by closest date in the past
      .order('end_time', { ascending: true }) // Further sort by earliest end_time on that date
      .limit(1); // Limit to one record

    if (error) throw error;
    return data[0] || null;
  } catch (error) {
    console.error('Error fetching most overdue session:', error.message);
    throw error;
  }
}

/**
 * Function to delete an event from database and then sync with Google Calendar
*/
async function deleteSession(sessionId, googleAccessToken = null) {
  try {
    const { data: session, error: fetchError } = await supabase
      .from('sessions')
      .select('start_time, end_time')
      .eq('session_id', sessionId)
      .single();

    if (fetchError || !session) {
      throw new Error('Session not found in database');
    }

    const { error: deleteError } = await supabase
      .from('sessions')
      .delete()
      .eq('session_id', sessionId);

    if (deleteError) {
      throw deleteError;
    }

    console.log('Session deleted from database');

    // Only delete from Google Calendar if googleAccessToken is provided
    if (googleAccessToken) {
      await deleteEventFromGoogleCalendar(googleAccessToken, sessionId);
      console.log('Session deleted from Google Calendar');
    } else {
      console.log('Google access token not provided. Skipping Calendar deletion.');
    }

  } catch (error) {
    console.error('Error deleting session or syncing with Google Calendar:', error.message);
  }
}


/**************************************************************
 * GOOGLE CALENDAR FUNCTIONS
**************************************************************/

/**
 * Function that allows for event to be added to Google Calendars
*/
async function addToGoogleCalendar(accessToken, eventDetails) {
  try {
    const response = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        summary: eventDetails.title,
        start: { dateTime: eventDetails.startDateTime },
        end: { dateTime: eventDetails.endDateTime },
        location: eventDetails.location,
        description: eventDetails.description,
        reminders: {
          useDefault: false,
          overrides: [
            { method: 'email', minutes: 24 * 60 },
            { method: 'popup', minutes: 10 },
          ],
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Error adding event to Google Calendar: ${response.statusText}`);
    }

    const event = await response.json();
    console.log('Event created:', event.htmlLink);

    // Returns a link to the event in Google Calendar
    return event.htmlLink;
  } catch (error) {
    console.error('Error adding event to Google Calendar:', error);
    throw error;
  }
}


/**
 * Function that allows for event to be deleted from Google Calendars
*/
async function deleteEventFromGoogleCalendar(accessToken, eventId) {
  try {
    const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Error deleting event from Google Calendar: ${response.statusText}`);
    }

    console.log('Event deleted from Google Calendar');
  } catch (error) {
    console.error('Error deleting event from Google Calendar:', error);
    throw error;
  }
}


/**************************************************************
 * BOOKING FUNCTIONS
**************************************************************/

/**
 * Helper: Function that will check if two events overlap
*/
function checkForOverlap(session1, session2) {
  const session1Start = moment.utc(`${session1.session_date} ${session1.start_time}`, 'YYYY-MM-DD HH:mm:ss');
  const session1End = moment.utc(`${session1.session_date} ${session1.end_time}`, 'YYYY-MM-DD HH:mm:ss');
  const session2Start = moment.utc(`${session2.session_date} ${session2.start_time}`, 'YYYY-MM-DD HH:mm:ss');
  const session2End = moment.utc(`${session2.session_date} ${session2.end_time}`, 'YYYY-MM-DD HH:mm:ss');

  return session1Start.isBefore(session2End) && session1End.isAfter(session2Start);
}

/**
 * Helper: Takes a list of sessions and checks if any overlap with the requested time slot
*/
function hasSchedulingConflicts(existingSessions, requestedSession) {
  return existingSessions.some(session => checkForOverlap(requestedSession, session));
}


/**
 * Helper: Function to check if the requested time falls within any of the tutor's availability times for requested day
*/
async function tutorAvailability(tutorId, dayOfWeek, startTime, endTime) {
  const startUTC = moment.utc(startTime, "h:mm A").format("HH:mm:ss");
  const endUTC = moment.utc(endTime, "h:mm A").format("HH:mm:ss");

  // Fetch all available records for the tutor for the requested day
  const { data: availability, error } = await supabase
    .from('availability')
    .select('*')
    .eq('tutor_id', tutorId)
    .contains('day_of_week', [dayOfWeek]);

  if (error || !availability || availability.length === 0) {
    console.error('Tutor availability not found:', error);
    return false;
  }

  // Compare requested time with available slots
  for (let slot of availability) {
    const availableStart = moment.utc(slot.start_time, "HH:mm:ss").format("HH:mm:ss");
    const availableEnd = moment.utc(slot.end_time, "HH:mm:ss").format("HH:mm:ss");

    // Check if the requested times fall within the availability range
    if (startUTC >= availableStart && endUTC <= availableEnd) {
      return true;
    }
  }

  return false; // No matching availability found
}

/**
 * Function that will update a tutors availability
*/
async function updateTutorAvailability(tutorId, newDaysOfWeek, startTime, endTime) {
  try {
    const { data, error } = await supabase
      .from('availability')
      .update({
        day_of_week: newDaysOfWeek,
        start_time: startTime,
        end_time: endTime,
      })
      .eq('tutor_id', tutorId);

    if (error) {
      console.error('Error updating tutor availability:', error);
      return { success: false, error };
    }

    console.log('Tutor availability updated successfully:', data);
    return { success: true, data };
  } catch (err) {
    console.error('Unexpected error during update:', err);
    return { success: false, error: err };
  }
}

async function fetchDayAvailability(tutorId) {
  try {
    const { data, error } = await supabase
      .from('availability')
      .select('day_of_week, start_time, end_time')
      .eq('tutor_id', tutorId);

    if (error) {
      console.error('Error fetching tutor availability:', error);
      return null;
    }

    // Assuming only one record per tutor in the table
    if (data.length > 0) {
      const { day_of_week, start_time, end_time } = data[0];
      return {
        day_of_week: day_of_week || [],
        start_time: start_time || null,
        end_time: end_time || null,
      };
    }

    return { day_of_week: [], start_time: null, end_time: null };
  } catch (err) {
    console.error('Unexpected error fetching tutor availability:', err);
    return { day_of_week: [], start_time: null, end_time: null };
  }
}

/**
 * Function that will check if the specified time slot for a student and a tutor 
 * This checks only the SPECIFIED time slot for conflict, rather than the entirety of the users' schedules
*/
async function validateBooking(studentId, tutorId, sessionDate, startTime, endTime) {
  const start24Hour = moment(startTime, ["h:mm A"]).format("HH:mm");
  const end24Hour = moment(endTime, ["h:mm A"]).format("HH:mm");

  // Ensure start time is before end time
  if (start24Hour >= end24Hour) {
    return { available: false, conflict: 'Start time must be before end time' };
  }

  // Calculate day of the week
  const dayOfWeek = moment(sessionDate).format('dddd');

  // Check tutor availability
  const available = await tutorAvailability(tutorId, dayOfWeek, start24Hour, end24Hour);
  if (!available) {
    return { available: false, conflict: 'Tutor is not available during the requested time' };
  }

  const requestedSession = { session_date: sessionDate, start_time: start24Hour, end_time: end24Hour };

  // Check for conflicts with the student's existing sessions
  const studentSessions = await fetchUserSessions(studentId);
  const studentSessionsOnDate = studentSessions.filter(session => session.session_date === sessionDate);
  if (hasSchedulingConflicts(studentSessionsOnDate, requestedSession)) {
    return { available: false, conflict: 'Student has a scheduling conflict' };
  }

  // Check for conflicts with the tutor's existing sessions
  const tutorSessions = await fetchUserSessions(tutorId);
  const tutorSessionsOnDate = tutorSessions.filter(session => session.session_date === sessionDate);
  if (hasSchedulingConflicts(tutorSessionsOnDate, requestedSession)) {
    return { available: false, conflict: 'Tutor has a scheduling conflict' };
  }

  // If no conflicts and tutor is available, return available status
  return { available: true };
}


/**
 * Function that allows for a session to be booked AFTER a timeslot has been validated
 * Checks to see if the user has a googleAccessToken before we update their schedule
*/  
async function bookSession(studentId, tutorId, sessionDate, startTime, endTime, subject, googleAccessToken = null) {
  try {
    // Book the session in database
    const { data, error } = await supabase
      .from('sessions')
      .insert({
        student_id: studentId,
        tutor_id: tutorId,
        session_date: sessionDate,
        start_time: startTime,
        end_time: endTime,
        subject: subject,
      })
      .select('*');

    if (error) throw error;
    console.log('Session booked successfully:');

    // Sync with Google Calendar if `googleAccessToken` is provided
    if (googleAccessToken) {
      await addToGoogleCalendar(googleAccessToken, {
        title: `Tutoring Session with ${studentId === userId ? 'Tutor' : 'Student'} ${studentId === userId ? tutorId : studentId}`,
        startDateTime: `${sessionDate}T${startTime}`,
        endDateTime: `${sessionDate}T${endTime}`,
        location: 'Online',
        description: 'Tutoring session scheduled through the app',
      });
      console.log('Session synced to Google Calendar');
    } else {
      console.log('Google access token not provided. Skipping Google Calendar sync.');
    }

    return data;
  } catch (error) {
    console.error('Error booking session:', error.message);
  }
}

const addTimeOff = async (tutorId, date) => {
  const formattedDate = moment(date).format("YYYY-MM-DD");

  try {
    // Add the time-off entry
    const { error: insertError } = await supabase
      .from("time_off")
      .insert({
        tutor_id: tutorId,
        date: formattedDate,
      });

    if (insertError) throw insertError;

  } catch (error) {
    console.error("Error adding time-off:", error.message);
  }
};

const fetchTimeOff = async (tutorId) => {
  try {
    const { data, error } = await supabase
      .from("time_off")
      .select("date")
      .eq("tutor_id", tutorId);

    if (error) throw error;

    return data.map((entry) => entry.date);
  } catch (error) {
    console.error("Error fetching time-off:", error.message);
    alert("Failed to fetch time-off data.");
    return [];
  }
};

const validateTimeOff = async (tutorId, sessionDate) => {
  try {
    const { data, error } = await supabase
      .from("time_off")
      .select("*")
      .eq("tutor_id", tutorId)
      .eq("date", moment(sessionDate).format("YYYY-MM-DD"));

    if (error) throw error;

    return data.length === 0; // True if tutor is available
  } catch (error) {
    console.error("Error validating session:", error.message);
    return false;
  }
};

async function removeTimeOff(tutorId, date) {
  try {
    const { error } = await supabase
      .from("time_off")
      .delete()
      .eq("tutor_id", tutorId)
      .eq("date", date);

    if (error) {
      console.error("Error removing time-off:", error.message);
      throw new Error(error.message); 
    }
  } catch (error) {
    console.error("Error removing time-off:", error.message);
    throw error;
  }
}

/**************************************************************
 * EXPORTS
**************************************************************/
export {
  checkForOverlap,
  fetchUserSessions,
  deleteSession,
  validateBooking,
  bookSession,
  tutorAvailability,
  hasSchedulingConflicts,
  validateTimeOff,
  addTimeOff,
  fetchTimeOff,
  removeTimeOff,
  updateTutorAvailability,
  fetchDayAvailability,
  fetchMostOverdueSession,
};