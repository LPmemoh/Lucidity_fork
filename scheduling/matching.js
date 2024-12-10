import { supabase } from '../lib/supabase';

/**
 * Helper: Function that will sort by matching score OR by name if they are the same matching score
*/
function sortTutors(tutorA, tutorB) {
    if (tutorB.matchingScore === tutorA.matchingScore) {
      return tutorA.name.localeCompare(tutorB.name); // Sort alphabetically by name
    }
    return tutorB.matchingScore - tutorA.matchingScore; // Sort by score descending
  }

async function findMatchingTutors(studentId) {
    try {
      // Get the students chosen topics
      const { data: studentData, error: studentError } = await supabase
        .from('students')
        .select('topics, grade_level')
        .eq('student_id', studentId)
        .single();

      // Error check
      if (studentError || !studentData) {
        console.error('Error fetching student topics:', studentError);
        return [];
      }
  
      const studentTopics = studentData.topics;
      const studentGradeLevel = studentData.grade_level;
  
      // Find tutors with overlapping subjects chosen
      const { data: tutorsData, error: tutorsError } = await supabase
        .from('tutors')
        .select('tutor_id, name, topics, grade_level')
        .not('topics', 'is', null);
      
      // Error check
      if (tutorsError || !tutorsData) {
        console.error('Error fetching tutors:', tutorsError);
        return [];
      }
  
      // Calculate matching score based on topic overlapping subjects chosen.
      // Gives higher precedence to tutors that overlap more with students selected subjects
      const tutorsWithScores = tutorsData
      .filter(tutor => tutor.grade_level === studentGradeLevel) // * Here is where we filter based on grade level *
          .map(tutor => {
          // Find overlapping topics
          const commonTopics = tutor.topics.filter(topic => studentTopics.includes(topic));
          return {
            ...tutor,
            matchingScore: commonTopics.length,
            commonTopics
          };
        })
        // Only want tutors with at least one matching topic
        .filter(tutor => tutor.matchingScore > 0); 
  
      // Sort tutors by matching score in descending order
      tutorsWithScores.sort(sortTutors);

      if (tutorsWithScores.length === 0) {
        console.warn('No tutors found with matching topics and grade level.');
    }
  
      // Returns an array of tutors that have a matching score and a list of commonTopics
      return tutorsWithScores;
  
    } catch (err) {
      console.error('Error finding matching tutors:', err);
      return [];
    }
  }

  export {
    findMatchingTutors,
    sortTutors
  }



/***************************** EXAMPLE USAGE *************************** */
// An idea of what it might look like to use the above function in our frontend
/*
import React, { useState, useEffect } from 'react';
import { findMatchingTutors } from '../scheduling/matching.js';

const MatchingTutors = ({ studentId }) => {
  const [tutors, setTutors] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const getTutors = async () => {
      setLoading(true);
      setError(null);

      try {
        const matchingTutors = await findMatchingTutors(studentId);
        if (matchingTutors.length === 0) {
          setError("No matching tutors found.");
        } else {
          setTutors(matchingTutors);
        }
      } catch (err) {
        setError("There was an error fetching matching tutors.");
        console.error("Error in fetching tutors:", err);
      } finally {
        setLoading(false);
      }
    };

    getTutors();
  }, [studentId]);
};
*/