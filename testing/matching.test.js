import { supabase } from '../lib/supabase';
import { findMatchingTutors, sortTutors } from '../scheduling/matching';

jest.mock('../lib/supabase', () => ({
  supabase: {
    from: jest.fn(),
  },
}));

describe('Matching Helpers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // Test sortTutors
  describe('sortTutors', () => {
    it('should sort tutors by matching score in descending order', () => {
      const tutors = [
        { name: 'Alice', matchingScore: 3 },
        { name: 'Bob', matchingScore: 5 },
        { name: 'Charlie', matchingScore: 2 },
      ];

      tutors.sort(sortTutors);

      expect(tutors).toEqual([
        { name: 'Bob', matchingScore: 5 },
        { name: 'Alice', matchingScore: 3 },
        { name: 'Charlie', matchingScore: 2 },
      ]);
    });

    it('should sort tutors alphabetically by name if scores are equal', () => {
      const tutors = [
        { name: 'Charlie', matchingScore: 3 },
        { name: 'Alice', matchingScore: 3 },
        { name: 'Bob', matchingScore: 3 },
      ];

      tutors.sort(sortTutors);

      expect(tutors).toEqual([
        { name: 'Alice', matchingScore: 3 },
        { name: 'Bob', matchingScore: 3 },
        { name: 'Charlie', matchingScore: 3 },
      ]);

    });

    it('should sort tutors by matching score and name', () => {
        const tutors = [
            { name: 'Charlie', matchingScore: 3 },
            { name: 'Alice', matchingScore: 3 },
            { name: 'Bob', matchingScore: 5 },
        ];
    
        const sortedTutors = [...tutors].sort(sortTutors);
    
        expect(sortedTutors).toEqual([
            { name: 'Bob', matchingScore: 5 },
            { name: 'Alice', matchingScore: 3 },
            { name: 'Charlie', matchingScore: 3 },
        ]);
    });
  });

  // Test findMatchingTutors
  describe('findMatchingTutors', () => {
    it('should return sorted matching tutors based on topics and grade level', async () => {
      const mockStudentData = {
        topics: ['Math', 'Science'],
        grade_level: '10',
      };

      const mockTutorsData = [
        { tutor_id: 1, name: 'Alice', topics: ['Math'], grade_level: '10' },
        { tutor_id: 2, name: 'Bob', topics: ['Math', 'Science'], grade_level: '10' },
        { tutor_id: 3, name: 'Charlie', topics: ['English'], grade_level: '10' },
        { tutor_id: 4, name: 'David', topics: ['Math'], grade_level: '11' }, // Different grade level
      ];

      supabase.from
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({ data: mockStudentData, error: null }),
            }),
          }),
        })
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            not: jest.fn().mockResolvedValue({ data: mockTutorsData, error: null }),
          }),
        });

      const result = await findMatchingTutors(1);

      expect(result).toEqual([
        {
          tutor_id: 2,
          name: 'Bob',
          topics: ['Math', 'Science'],
          grade_level: '10',
          matchingScore: 2,
          commonTopics: ['Math', 'Science'],
        },
        {
          tutor_id: 1,
          name: 'Alice',
          topics: ['Math'],
          grade_level: '10',
          matchingScore: 1,
          commonTopics: ['Math'],
        },
      ]);
    });

    it('should return an empty array if no matching tutors are found', async () => {
      const mockStudentData = {
        topics: ['Math', 'Science'],
        grade_level: '10',
      };

      const mockTutorsData = [
        { tutor_id: 1, name: 'Alice', topics: ['English'], grade_level: '10' },
        { tutor_id: 2, name: 'Bob', topics: ['History'], grade_level: '11' },
      ];

      supabase.from
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({ data: mockStudentData, error: null }),
            }),
          }),
        })
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            not: jest.fn().mockResolvedValue({ data: mockTutorsData, error: null }),
          }),
        });

      const result = await findMatchingTutors(1);

      expect(result).toEqual([]);
      expect(console.warn).toHaveBeenCalledWith(
        'No tutors found with matching topics and grade level.'
      );
    });

    it('should return an empty array and log an error if fetching student data fails', async () => {
      supabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: null, error: 'Fetch error' }),
          }),
        }),
      });

      const result = await findMatchingTutors(1);

      expect(result).toEqual([]);
      expect(console.error).toHaveBeenCalledWith(
        'Error fetching student topics:',
        'Fetch error'
      );
    });

    it('should return an empty array and log an error if fetching tutors data fails', async () => {
      const mockStudentData = {
        topics: ['Math', 'Science'],
        grade_level: '10',
      };

      supabase.from
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({ data: mockStudentData, error: null }),
            }),
          }),
        })
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            not: jest.fn().mockResolvedValue({ data: null, error: 'Fetch error' }),
          }),
        });

      const result = await findMatchingTutors(1);

      expect(result).toEqual([]);
      expect(console.error).toHaveBeenCalledWith(
        'Error fetching tutors:',
        'Fetch error'
      );
    });
  });
});
