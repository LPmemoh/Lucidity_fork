import {
    validateBooking,
    bookSession,
  } from '../scheduling/calendar';
  import { supabase } from '../lib/supabase';
  
  jest.mock('../lib/supabase', () => ({
    supabase: {
      from: jest.fn(),
    },
  }));
  
  jest.mock('../scheduling/calendar', () => ({
    ...jest.requireActual('../scheduling/calendar'),
    tutorAvailability: jest.fn(),
    fetchUserSessions: jest.fn(),
    hasSchedulingConflicts: jest.fn(),
  }));
  
  const mockTutorAvailability = require('../scheduling/calendar').tutorAvailability;
  const mockFetchUserSessions = require('../scheduling/calendar').fetchUserSessions;
  const mockHasSchedulingConflicts = require('../scheduling/calendar').hasSchedulingConflicts;
  
  describe('Booking Functions', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        jest.spyOn(console, 'error').mockImplementation(() => {});
        jest.spyOn(console, 'log').mockImplementation(() => {});
        });
    
    afterEach(() => {
        jest.clearAllMocks();
    });
  
    // Test validateBooking
    describe('validateBooking', () => {
        beforeEach(() => {
            supabase.from.mockReturnValue({
                select: jest.fn().mockReturnValue({
                  eq: jest.fn().mockReturnValue({
                    contains: jest.fn(),
                  }),
                }),
              });
            });

        it('should return conflict if the tutor is unavailable', async () => {
            // Mock tutorAvailability here
            supabase.from.mockReturnValue({
                select: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                    contains: jest.fn().mockResolvedValue({
                    data: [{ start_time: '12:00:00', end_time: '13:00:00', day_of_week: [1, 2, 3, 4, 5] }],
                    error: null,
                    }),
                }),
                }),
            });
        
            const result = await validateBooking(1, 2, '2024-12-09', '10:00 AM', '11:00 AM');
            expect(result).toEqual({
                available: false,
                conflict: 'Tutor is not available during the requested time',
            });
        });
    
        it('should return available if no conflicts and tutor is available', async () => {
        supabase.from.mockReturnValue({
            select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
                contains: jest.fn().mockResolvedValue({
                data: [{ start_time: '09:00:00', end_time: '17:00:00', day_of_week: [1, 2, 3, 4, 5] }],
                error: null,
                }),
            }),
            }),
        });
    
        mockTutorAvailability.mockResolvedValue(true);
        mockFetchUserSessions.mockResolvedValue([]);
        mockHasSchedulingConflicts.mockReturnValue(false);
    
        const result = await validateBooking(1, 2, '2024-12-09', '10:00 AM', '11:00 AM');
        expect(result).toEqual({ available: true });
        });
    });

    // Test bookSession
    describe('bookSession', () => {
        it('should successfully book a session in the database', async () => {
          const mockData = [
            {
              id: 1,
              student_id: 1,
              tutor_id: 2,
              session_date: '2024-12-09',
              start_time: '10:00:00',
              end_time: '11:00:00',
              subject: 'Math',
            },
          ];
    
          supabase.from.mockReturnValue({
            insert: jest.fn().mockReturnValue({
              select: jest.fn().mockResolvedValue({ data: mockData, error: null }),
            }),
          });
    
          const result = await bookSession(1, 2, '2024-12-09', '10:00 AM', '11:00 AM', 'Math');
          expect(result).toEqual(mockData);
          expect(supabase.from).toHaveBeenCalledWith('sessions');
          expect(console.log).toHaveBeenCalledWith('Session booked successfully:');
          expect(console.log).toHaveBeenCalledWith('Google access token not provided. Skipping Google Calendar sync.');
        });
    
        it('should handle errors when booking a session in the database', async () => {
            const mockError = { message: 'Database error' }; // Error object with a message
          
            supabase.from.mockReturnValue({
              insert: jest.fn().mockReturnValue({
                select: jest.fn().mockResolvedValue({ data: null, error: mockError }),
              }),
            });
          
            const result = await bookSession(1, 2, '2024-12-09', '10:00 AM', '11:00 AM', 'Math');
            expect(result).toBeUndefined();
            expect(console.error).toHaveBeenCalledWith('Error booking session:', 'Database error');
        });
    
        it('should log Google Calendar sync message when no token is provided', async () => {
          const mockData = [
            {
              id: 1,
              student_id: 1,
              tutor_id: 2,
              session_date: '2024-12-09',
              start_time: '10:00:00',
              end_time: '11:00:00',
              subject: 'Math',
            },
          ];
    
          supabase.from.mockReturnValue({
            insert: jest.fn().mockReturnValue({
              select: jest.fn().mockResolvedValue({ data: mockData, error: null }),
            }),
          });
    
          await bookSession(1, 2, '2024-12-09', '10:00 AM', '11:00 AM', 'Math');
          expect(console.log).toHaveBeenCalledWith('Google access token not provided. Skipping Google Calendar sync.');
        });
      });
});