import { 
    fetchUserSessions, 
    fetchMostOverdueSession,
    deleteSession ,
    checkForOverlap,
    hasSchedulingConflicts,
    tutorAvailability,
    updateTutorAvailability,
    fetchDayAvailability,
    addTimeOff,
    fetchTimeOff,
    validateTimeOff,
    removeTimeOff,
} from '../scheduling/calendar';
import { supabase } from '../lib/supabase';

jest.mock('../lib/supabase', () => ({
    supabase: {
      from: jest.fn(),
    },
  }));

global.alert = jest.fn();

/**************************************************************
* DATABASE FUNCTIONS
**************************************************************/

describe('Calendar Functions', () => {
beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
    });

afterEach(() => {
    jest.clearAllMocks();
});

    // Test fetchUserSessions
    describe('fetchUserSessions', () => {
        
        it('should fetch sessions successfully', async () => {
        const mockData = [
            { session_date: '2024-12-09', start_time: '10:00', student_id: 1, tutor_id: 2 },
            { session_date: '2024-12-10', start_time: '09:00', student_id: 1, tutor_id: 3 },
        ];

        supabase.from.mockReturnValue({
            select: jest.fn().mockReturnValue({
            or: jest.fn().mockReturnValue({
                order: jest.fn().mockReturnValue({
                order: jest.fn().mockResolvedValue({ data: mockData, error: null }),
                }),
            }),
            }),
        });

        const result = await fetchUserSessions(1);
        expect(result).toEqual(mockData);
        expect(supabase.from).toHaveBeenCalledWith('sessions');
        });

        it('should return an empty array when an error occurs', async () => {
        supabase.from.mockReturnValue({
            select: jest.fn().mockReturnValue({
            or: jest.fn().mockReturnValue({
                order: jest.fn().mockReturnValue({
                order: jest.fn().mockResolvedValue({ data: null, error: 'Some error' }),
                }),
            }),
            }),
        });

        const result = await fetchUserSessions(1);
        expect(result).toEqual([]);
        expect(console.error).toHaveBeenCalledWith('Error fetching sessions:', 'Some error');
        });

        it('should handle an invalid userId gracefully', async () => {
        const result = await fetchUserSessions(null);
        expect(result).toEqual([]);
        });
    });

    // Test fetchMostOverdueSession
    describe('fetchMostOverdueSession', () => {
        it('should fetch the most overdue session successfully', async () => {
            const mockData = [
            { session_id: 1, session_date: '2024-12-01', end_time: '10:00' },
            ];

            supabase.from.mockReturnValue({
            select: jest.fn().mockReturnValue({
                lt: jest.fn().mockReturnValue({
                order: jest.fn().mockReturnValue({
                    order: jest.fn().mockReturnValue({
                    limit: jest.fn().mockResolvedValue({ data: mockData, error: null }),
                    }),
                }),
                }),
            }),
            });

            const result = await fetchMostOverdueSession();
            expect(result).toEqual(mockData[0]);
            expect(supabase.from).toHaveBeenCalledWith('sessions');
        });

        it('should return null if no overdue session is found', async () => {
            supabase.from.mockReturnValue({
            select: jest.fn().mockReturnValue({
                lt: jest.fn().mockReturnValue({
                order: jest.fn().mockReturnValue({
                    order: jest.fn().mockReturnValue({
                    limit: jest.fn().mockResolvedValue({ data: [], error: null }),
                    }),
                }),
                }),
            }),
            });

            const result = await fetchMostOverdueSession();
            expect(result).toBeNull();
        });

        it('should throw an error when the query fails', async () => {
            const mockError = new Error('Database error');
          
            supabase.from.mockReturnValue({
              select: jest.fn().mockReturnValue({
                lt: jest.fn().mockReturnValue({
                  order: jest.fn().mockReturnValue({
                    order: jest.fn().mockReturnValue({
                      limit: jest.fn().mockResolvedValue({ data: null, error: mockError }),
                    }),
                  }),
                }),
              }),
            });
          
            jest.spyOn(console, 'error').mockImplementation(() => {}); 
          
            await expect(fetchMostOverdueSession()).rejects.toThrow('Database error');
            expect(console.error).toHaveBeenCalledWith(
              'Error fetching most overdue session:',
              'Database error'
            );
          });
        });

    // Test deleteSession
    describe('deleteSession', () => {
        it('should delete a session successfully from the database', async () => {
            jest.spyOn(console, 'log').mockImplementation(() => {});
            
            supabase.from
                .mockReturnValueOnce({
                select: jest.fn().mockReturnValue({
                    eq: jest.fn().mockReturnValue({
                    single: jest.fn().mockResolvedValue({
                        data: { start_time: '10:00', end_time: '12:00' },
                        error: null,
                    }),
                    }),
                }),
                })
                .mockReturnValueOnce({
                delete: jest.fn().mockReturnValue({
                    eq: jest.fn().mockResolvedValue({ data: {}, error: null }),
                }),
                });
            
            await deleteSession(1);
            
            expect(supabase.from).toHaveBeenCalledWith('sessions');
            expect(console.log).toHaveBeenCalledWith('Session deleted from database');
            });

        it('should log an error if the session is not found', async () => {
            supabase.from.mockReturnValueOnce({
            select: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({ data: null, error: 'Not found' }),
                }),
            }),
            });

            await deleteSession(1);

            expect(console.error).toHaveBeenCalledWith(
            'Error deleting session or syncing with Google Calendar:',
            'Session not found in database'
            );
        });

        it('should log an error if deleting the session fails', async () => {
            jest.spyOn(console, 'error').mockImplementation(() => {});
        
            supabase.from
            .mockReturnValueOnce({
                select: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                    single: jest.fn().mockResolvedValue({
                    data: { start_time: '10:00', end_time: '12:00' },
                    error: null,
                    }),
                }),
                }),
            })
            .mockReturnValueOnce({
                delete: jest.fn().mockReturnValue({
                eq: jest.fn().mockResolvedValue({
                    data: null,
                    error: { message: 'Delete error' },
                }),
                }),
            });
        
            await deleteSession(1);
        
            expect(console.error).toHaveBeenCalledWith(
            'Error deleting session or syncing with Google Calendar:',
            'Delete error'
            );
        });
    });


/**************************************************************
* BOOKING FUNCTIONS
**************************************************************/

    // Test checkForOverlap
    describe('checkForOverlap', () => {
        it('should detect overlapping sessions', () => {
          const session1 = { session_date: '2024-12-09', start_time: '10:00:00', end_time: '12:00:00' };
          const session2 = { session_date: '2024-12-09', start_time: '11:00:00', end_time: '13:00:00' };
    
          expect(checkForOverlap(session1, session2)).toBe(true);
        });
    
        it('should return false for non-overlapping sessions', () => {
          const session1 = { session_date: '2024-12-09', start_time: '10:00:00', end_time: '12:00:00' };
          const session2 = { session_date: '2024-12-09', start_time: '12:00:01', end_time: '13:00:00' };
    
          expect(checkForOverlap(session1, session2)).toBe(false);
        });
      });

    // Test hasSchedulingConflicts
    describe('hasSchedulingConflicts', () => {
        it('should return true if scheduling conflicts exist', () => {
            const existingSessions = [
            { session_date: '2024-12-09', start_time: '10:00:00', end_time: '12:00:00' },
            ];
            const requestedSession = { session_date: '2024-12-09', start_time: '11:00:00', end_time: '13:00:00' };

            expect(hasSchedulingConflicts(existingSessions, requestedSession)).toBe(true);
        });

        it('should return false if no scheduling conflicts exist', () => {
            const existingSessions = [
            { session_date: '2024-12-09', start_time: '10:00:00', end_time: '12:00:00' },
            ];
            const requestedSession = { session_date: '2024-12-09', start_time: '12:00:01', end_time: '13:00:00' };

            expect(hasSchedulingConflicts(existingSessions, requestedSession)).toBe(false);
        });
      });

    // Test tutorAvailability
    describe('tutorAvailability', () => {
        it('should return true if requested time falls within availability', async () => {
            const mockData = [
            { start_time: '09:00:00', end_time: '17:00:00', day_of_week: [1, 2, 3, 4, 5] },
            ];
            supabase.from.mockReturnValue({
            select: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                contains: jest.fn().mockResolvedValue({ data: mockData, error: null }),
                }),
            }),
            });

            const result = await tutorAvailability(1, 1, '10:00 AM', '11:00 AM');
            expect(result).toBe(true);
        });

        it('should return false if no matching availability exists', async () => {
            const mockData = [];
            supabase.from.mockReturnValue({
            select: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                contains: jest.fn().mockResolvedValue({ data: mockData, error: null }),
                }),
            }),
            });

            const result = await tutorAvailability(1, 1, '10:00 AM', '11:00 AM');
            expect(result).toBe(false);
        });

        it('should log an error and return false if there is an error', async () => {
            jest.spyOn(console, 'error').mockImplementation(() => {});

            supabase.from.mockReturnValue({
            select: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                contains: jest.fn().mockResolvedValue({ data: null, error: 'Database error' }),
                }),
            }),
            });

            const result = await tutorAvailability(1, 1, '10:00 AM', '11:00 AM');
            expect(result).toBe(false);
            expect(console.error).toHaveBeenCalledWith('Tutor availability not found:', 'Database error');
        });
    });

    // Test updateTutorAvailability
    describe('updateTutorAvailability', () => {
        it('should update tutor availability successfully', async () => {
          const mockData = { id: 1, day_of_week: [1, 2, 3, 4, 5] };
    
          supabase.from.mockReturnValue({
            update: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({ data: mockData, error: null }),
            }),
          });
    
          const result = await updateTutorAvailability(1, [1, 2, 3], '09:00:00', '17:00:00');
          expect(result.success).toBe(true);
          expect(result.data).toEqual(mockData);
        });
    
        it('should return an error if update fails', async () => {
          jest.spyOn(console, 'error').mockImplementation(() => {});
    
          supabase.from.mockReturnValue({
            update: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({ data: null, error: 'Update failed' }),
            }),
          });
    
          const result = await updateTutorAvailability(1, [1, 2, 3], '09:00:00', '17:00:00');
          expect(result.success).toBe(false);
          expect(result.error).toBe('Update failed');
          expect(console.error).toHaveBeenCalledWith('Error updating tutor availability:', 'Update failed');
        });
    });

    // Test fetchDayAvailability
    describe('fetchDayAvailability', () => {
        it('should fetch day availability successfully', async () => {
          const mockData = [
            { day_of_week: [1, 2, 3], start_time: '09:00:00', end_time: '17:00:00' },
          ];
    
          supabase.from.mockReturnValue({
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({ data: mockData, error: null }),
            }),
          });
    
          const result = await fetchDayAvailability(1);
          expect(result).toEqual({
            day_of_week: [1, 2, 3],
            start_time: '09:00:00',
            end_time: '17:00:00',
          });
        });
    
        it('should return null if an error occurs', async () => {
          jest.spyOn(console, 'error').mockImplementation(() => {});
    
          supabase.from.mockReturnValue({
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({ data: null, error: 'Fetch error' }),
            }),
          });
    
          const result = await fetchDayAvailability(1);
          expect(result).toBeNull();
          expect(console.error).toHaveBeenCalledWith('Error fetching tutor availability:', 'Fetch error');
        });
    
        it('should return default values if no availability exists', async () => {
          supabase.from.mockReturnValue({
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({ data: [], error: null }),
            }),
          });
    
          const result = await fetchDayAvailability(1);
          expect(result).toEqual({ day_of_week: [], start_time: null, end_time: null });
        });
    });

    // Test addTimeOff
  describe('addTimeOff', () => {
    it('should add time-off successfully', async () => {
      supabase.from.mockReturnValue({
        insert: jest.fn().mockResolvedValue({ error: null }),
      });

      await addTimeOff(1, '2024-12-09');

      expect(supabase.from).toHaveBeenCalledWith('time_off');
      expect(supabase.from().insert).toHaveBeenCalledWith({
        tutor_id: 1,
        date: '2024-12-09',
      });
    });

    it('should log an error if adding time-off fails', async () => {
      const mockError = { message: 'Insert error' };

      supabase.from.mockReturnValue({
        insert: jest.fn().mockResolvedValue({ error: mockError }),
      });

      await addTimeOff(1, '2024-12-09');

      expect(console.error).toHaveBeenCalledWith('Error adding time-off:', 'Insert error');
    });
  });

  // Test fetchTimeOff
  describe('fetchTimeOff', () => {
    it('should fetch time-off dates successfully', async () => {
      const mockData = [{ date: '2024-12-09' }, { date: '2024-12-10' }];

      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ data: mockData, error: null }),
        }),
      });

      const result = await fetchTimeOff(1);
      expect(result).toEqual(['2024-12-09', '2024-12-10']);
    });

    it('should return an empty array and log an error if fetching time-off fails', async () => {
      const mockError = { message: 'Fetch error' };

      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ data: null, error: mockError }),
        }),
      });

      const result = await fetchTimeOff(1);
      expect(result).toEqual([]);
      expect(console.error).toHaveBeenCalledWith('Error fetching time-off:', 'Fetch error');
    });
  });

  // Test validateTimeOff
  describe('validateTimeOff', () => {
    it('should return true if the tutor is available on the given date', async () => {
      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({ data: [], error: null }),
          }),
        }),
      });

      const result = await validateTimeOff(1, '2024-12-09');
      expect(result).toBe(true);
    });

    it('should return false if the tutor is not available on the given date', async () => {
      const mockData = [{ id: 1, date: '2024-12-09' }];

      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({ data: mockData, error: null }),
          }),
        }),
      });

      const result = await validateTimeOff(1, '2024-12-09');
      expect(result).toBe(false);
    });

    it('should return false and log an error if validation fails', async () => {
      const mockError = { message: 'Validation error' };

      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({ data: null, error: mockError }),
          }),
        }),
      });

      const result = await validateTimeOff(1, '2024-12-09');
      expect(result).toBe(false);
      expect(console.error).toHaveBeenCalledWith('Error validating session:', 'Validation error');
    });
  });

  // Test removeTimeOff
  describe('removeTimeOff', () => {
    it('should remove time-off successfully', async () => {
      supabase.from.mockReturnValue({
        delete: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({ error: null }),
          }),
        }),
      });

      await removeTimeOff(1, '2024-12-09');

      expect(supabase.from).toHaveBeenCalledWith('time_off');
      expect(supabase.from().delete).toHaveBeenCalled();
    });

    it('should log an error if removing time-off fails', async () => {
        const mockError = { message: 'Delete error' };
      
        supabase.from.mockReturnValue({
          delete: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({ error: mockError }),
            }),
          }),
        });
      
        await expect(removeTimeOff(1, '2024-12-09')).rejects.toThrow('Delete error');
        expect(console.error).toHaveBeenCalledWith('Error removing time-off:', 'Delete error');
    });
  });
});