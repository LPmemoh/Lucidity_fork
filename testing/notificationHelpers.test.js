import {
    checkUnreadNotifications,
    createNotification,
    fetchNotifications,
    markNotificationAsRead,
    markAllNotificationsAsRead,
    handleDeleteNotification,
    clearAll,
  } from '../scheduling/notificationHelpers';
  import { supabase } from '../lib/supabase';
  
  jest.mock('../lib/supabase', () => ({
    supabase: {
      from: jest.fn(),
    },
  }));

  describe('Notification Helpers', () => {
    beforeEach(() => {
      jest.clearAllMocks();
      jest.spyOn(console, 'error').mockImplementation(() => {});
    });
  
    afterEach(() => {
      jest.clearAllMocks();
    });
  
    // Test checkUnreadNotifications
    describe('checkUnreadNotifications', () => {
      it('should return true if unread notifications exist', async () => {
        const mockData = [{ id: 1, is_read: false }];
        supabase.from.mockReturnValue({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({ data: mockData, error: null }),
            }),
          }),
        });
  
        const result = await checkUnreadNotifications(1);
        expect(result).toBe(true);
      });
  
      it('should return false if there are no unread notifications', async () => {
        supabase.from.mockReturnValue({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({ data: [], error: null }),
            }),
          }),
        });
  
        const result = await checkUnreadNotifications(1);
        expect(result).toBe(false);
      });
  
      it('should return false and log an error if fetching fails', async () => {
        supabase.from.mockReturnValue({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({ data: null, error: 'Fetch error' }),
            }),
          }),
        });
  
        const result = await checkUnreadNotifications(1);
        expect(result).toBe(false);
        expect(console.error).toHaveBeenCalledWith('Error fetching unread notifications:', 'Fetch error');
      });
    });
  
    // Test createNotification
    describe('createNotification', () => {
      it('should log an error if notification creation fails', async () => {
        supabase.from.mockReturnValue({
          insert: jest.fn().mockResolvedValue({ data: null, error: 'Insert error' }),
        });
  
        const result = await createNotification(1, 'Test notification', 'test@example.com', 'type');
        expect(result).toBeNull();
        expect(console.error).toHaveBeenCalledWith('Error creating notification:', 'Insert error');
      });
    });
  
    // Test fetchNotifications
    describe('fetchNotifications', () => {
      it('should fetch notifications successfully', async () => {
        const mockData = [{ id: 1, message: 'Test notification' }];
        supabase.from.mockReturnValue({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              order: jest.fn().mockResolvedValue({ data: mockData, error: null }),
            }),
          }),
        });
  
        const result = await fetchNotifications(1);
        expect(result).toEqual(mockData);
      });
  
      it('should return an empty array and log an error if fetching fails', async () => {
        supabase.from.mockReturnValue({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              order: jest.fn().mockResolvedValue({ data: null, error: 'Fetch error' }),
            }),
          }),
        });
  
        const result = await fetchNotifications(1);
        expect(result).toEqual([]);
        expect(console.error).toHaveBeenCalledWith('Error fetching notifications:', 'Fetch error');
      });
    });
  
    // Test markNotificationAsRead
    describe('markNotificationAsRead', () => {
      it('should mark a notification as read successfully', async () => {
        const mockData = [{ id: 1, is_read: true }];
        supabase.from.mockReturnValue({
          update: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({ data: mockData, error: null }),
          }),
        });
  
        const result = await markNotificationAsRead(1);
        expect(result).toEqual(mockData);
      });
  
      it('should return null and log an error if marking fails', async () => {
        supabase.from.mockReturnValue({
          update: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({ data: null, error: 'Update error' }),
          }),
        });
  
        const result = await markNotificationAsRead(1);
        expect(result).toBeNull();
        expect(console.error).toHaveBeenCalledWith('Error marking notification as read:', 'Update error');
      });
    });
  
    // Test markAllNotificationsAsRead
    describe('markAllNotificationsAsRead', () => {
      it('should mark all notifications as read successfully', async () => {
        const mockData = [{ id: 1, is_read: true }];
        supabase.from.mockReturnValue({
          update: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({ data: mockData, error: null }),
            }),
          }),
        });
  
        const result = await markAllNotificationsAsRead(1);
        expect(result).toEqual(mockData);
      });
  
      it('should log an error if marking all notifications as read fails', async () => {
        supabase.from.mockReturnValue({
          update: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({ data: null, error: 'Update error' }),
            }),
          }),
        });
  
        const result = await markAllNotificationsAsRead(1);
        expect(result).toBeNull();
        expect(console.error).toHaveBeenCalledWith('Error marking notifications as read:', 'Update error');
      });
    });
  
    // Test handleDeleteNotification
    describe('handleDeleteNotification', () => {
        it('should delete a notification and update frontend state', async () => {
            const mockSetNotifications = jest.fn();
            const notificationId = 1;
            const prevNotifications = [{ notification_id: 1 }, { notification_id: 2 }];
            
            supabase.from.mockReturnValue({
                delete: jest.fn().mockReturnValue({
                eq: jest.fn().mockResolvedValue({ error: null }),
                }),
            });
            
            mockSetNotifications.mockImplementation((updateFn) => {
                const updatedNotifications = updateFn(prevNotifications);
                expect(updatedNotifications).toEqual([{ notification_id: 2 }]); // Validate updated state
            });
            
            await handleDeleteNotification(notificationId, mockSetNotifications);
            
            expect(mockSetNotifications).toHaveBeenCalledTimes(1); // Ensure setNotifications was called once
        });
  
      it('should log an error if deleting a notification fails', async () => {
        supabase.from.mockReturnValue({
          delete: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({ error: 'Delete error' }),
          }),
        });
  
        const mockSetNotifications = jest.fn();
        await handleDeleteNotification(1, mockSetNotifications);
  
        expect(console.error).toHaveBeenCalledWith('Error deleting notification:', 'Delete error');
      });
    });
  
    // Test clearAll
    describe('clearAll', () => {
      it('should delete all notifications and update frontend state', async () => {
        const mockSetNotifications = jest.fn();
        supabase.from.mockReturnValue({
          delete: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({ error: null }),
          }),
        });
  
        await clearAll(mockSetNotifications, 1);
        expect(mockSetNotifications).toHaveBeenCalledWith([]);
      });
  
      it('should log an error if clearing notifications fails', async () => {
        supabase.from.mockReturnValue({
          delete: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({ error: 'Delete error' }),
          }),
        });
  
        const mockSetNotifications = jest.fn();
        await clearAll(mockSetNotifications, 1);
  
        expect(console.error).toHaveBeenCalledWith('Error clearing notifications:', 'Delete error');
      });
    });
  });