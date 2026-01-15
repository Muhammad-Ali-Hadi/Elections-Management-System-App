const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

console.log('API Base URL:', API_BASE_URL);

// Token helpers: use sessionStorage for per-tab isolation so admin and voter can stay signed in on different tabs/devices without clobbering tokens.
const TOKEN_KEY = 'authToken';

const getAuthToken = () => {
  return sessionStorage.getItem(TOKEN_KEY) || localStorage.getItem(TOKEN_KEY) || null;
};

const setAuthToken = (token) => {
  sessionStorage.setItem(TOKEN_KEY, token);
  // Clean old storage to avoid cross-tab leakage
  localStorage.removeItem(TOKEN_KEY);
};

const clearAuthToken = () => {
  sessionStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(TOKEN_KEY);
};

// Helper function for API calls
const apiCall = async (endpoint, options = {}) => {
  const url = `${API_BASE_URL}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  const token = getAuthToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    console.log('Making API call to:', url);
    const response = await fetch(url, {
      ...options,
      headers,
    });

    console.log('Response status:', response.status);
    
    const data = await response.json().catch(() => ({ message: 'Failed to parse response' }));

    if (!response.ok) {
      console.error('API error:', data);
      throw new Error(data.message || `API request failed with status ${response.status}`);
    }

    console.log('API response:', data);
    return data;
  } catch (error) {
    console.error('API call error:', error);
    throw error;
  }
};

// ADMIN APIs
export const adminAPI = {
  login: async (username, password) => {
    console.log('🔐 Admin login attempt:', { username });
    try {
      const data = await apiCall('/admin/login', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      });
      console.log('✅ Admin login response:', data);
      if (data.token) {
        setAuthToken(data.token);
      }
      return data;
    } catch (error) {
      console.error('❌ Admin login error:', error);
      throw error;
    }
  },

  getProfile: async () => {
    return apiCall('/admin/profile', {
      method: 'GET',
    });
  },

  setElectionStatus: async (electionId, isOpen) => {
    return apiCall(`/admin/election/${electionId}/status`, {
      method: 'PUT',
      body: JSON.stringify({ isOpen }),
    });
  },

  getElectionStatus: async (electionId) => {
    return apiCall(`/admin/election/${electionId}/status`, {
      method: 'GET',
    });
  },

  updateElectionSchedule: async (electionId, schedule) => {
    return apiCall(`/admin/election/${electionId}/schedule`, {
      method: 'PUT',
      body: JSON.stringify(schedule),
    });
  },

  resetElection: async (electionId, payload = {}) => {
    return apiCall(`/admin/election/${electionId}/reset`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
};

// VOTER APIs
export const voterAPI = {
  login: async (flatNumber, password) => {
    const data = await apiCall('/voters/login', {
      method: 'POST',
      body: JSON.stringify({ flatNumber, password }),
    });
    if (data.token) {
      setAuthToken(data.token);
    }
    return data;
  },

  getProfile: async () => {
    return apiCall('/voters/profile', {
      method: 'GET',
    });
  },

  updateProfile: async (voterData) => {
    return apiCall('/voters/profile', {
      method: 'PUT',
      body: JSON.stringify(voterData),
    });
  },

  createVoter: async (voterData) => {
    return apiCall('/voters/create', {
      method: 'POST',
      body: JSON.stringify(voterData),
    });
  },

  getAllVoters: async () => {
    return apiCall('/voters/all', {
      method: 'GET',
    });
  },

  deleteVoter: async (voterId) => {
    return apiCall(`/voters/${voterId}`, {
      method: 'DELETE',
    });
  },

  logout: () => {
    clearAuthToken();
  },
};

// CANDIDATE APIs
export const candidateAPI = {
  getCandidates: async (electionId) => {
    const response = await apiCall(`/candidates/${electionId}`, {
      method: 'GET',
    });
    return response.candidates || response || [];
  },

  getCandidatesByPosition: async (electionId, position) => {
    const response = await apiCall(`/candidates/position/${electionId}/${position}`, {
      method: 'GET',
    });
    return response.candidates || response || [];
  },

  getCandidateById: async (candidateId) => {
    const response = await apiCall(`/candidates/by-id/${candidateId}`, {
      method: 'GET',
    });
    return response.candidate || response;
  },

  createCandidate: async (candidateData) => {
    return apiCall('/candidates/create', {
      method: 'POST',
      body: JSON.stringify(candidateData),
    });
  },

  updateCandidate: async (candidateId, candidateData) => {
    return apiCall(`/candidates/${candidateId}`, {
      method: 'PUT',
      body: JSON.stringify(candidateData),
    });
  },

  deleteCandidate: async (candidateId) => {
    return apiCall(`/candidates/${candidateId}`, {
      method: 'DELETE',
    });
  },
};

// VOTE APIs
export const voteAPI = {
  castVote: async (electionId, votes) => {
    console.log('🔍 VOTE DATA BEING SENT:', {
      electionId,
      votes,
      voteTypes: Object.entries(votes).reduce((acc, [key, val]) => {
        acc[key] = typeof val + ' (value: ' + val + ')';
        return acc;
      }, {})
    });
    
    const votePayload = { electionId, votes };
    console.log('📤 VOTE PAYLOAD:', JSON.stringify(votePayload, null, 2));
    
    return apiCall('/votes/cast', {
      method: 'POST',
      body: JSON.stringify(votePayload),
    });
  },

  checkVoterStatus: async (electionId) => {
    return apiCall(`/votes/status/${electionId}`, {
      method: 'GET',
    });
  },

  getResults: async (electionId) => {
    return apiCall(`/votes/results/${electionId}`, {
      method: 'GET',
    });
  },

  getVotesByPosition: async (electionId, position) => {
    return apiCall(`/votes/position/${electionId}/${position}`, {
      method: 'GET',
    });
  },
};

// ATTENDANCE APIs
export const attendanceAPI = {
  recordAttendance: async (electionId) => {
    const response = await apiCall('/attendance/record', {
      method: 'POST',
      body: JSON.stringify({ electionId }),
    });
    return response.attendance || response;
  },

  getAttendanceReport: async (electionId) => {
    const response = await apiCall(`/attendance/report/${electionId}`, {
      method: 'GET',
    });
    console.log('📊 getAttendanceReport response:', response);
    return response; // Returns { success: true, report: {...} }
  },

  getAttendanceByFlat: async (flatNumber, electionId) => {
    const response = await apiCall(`/attendance/by-flat/${flatNumber}/${electionId}`, {
      method: 'GET',
    });
    return response.attendance || response;
  },

  updateVoteStatus: async (attendanceId) => {
    return apiCall(`/attendance/${attendanceId}/vote-status`, {
      method: 'PUT',
    });
  },
};

// COMMITTEE APIs
export const committeeAPI = {
  getMembers: async (electionId) => {
    return apiCall(`/committee/${electionId}`, {
      method: 'GET',
    });
  },

  getMemberById: async (memberId) => {
    return apiCall(`/committee/by-id/${memberId}`, {
      method: 'GET',
    });
  },

  createMember: async (memberData) => {
    return apiCall('/committee/create', {
      method: 'POST',
      body: JSON.stringify(memberData),
    });
  },

  updateMember: async (memberId, memberData) => {
    return apiCall(`/committee/${memberId}`, {
      method: 'PUT',
      body: JSON.stringify(memberData),
    });
  },

  deleteMember: async (memberId) => {
    return apiCall(`/committee/${memberId}`, {
      method: 'DELETE',
    });
  },
};

// RESULTS APIs
export const resultsAPI = {
  getCurrentResults: async (electionId) => {
    const response = await apiCall(`/results/${electionId}`, {
      method: 'GET',
    });
    return response.results || response;
  },

  getElectionScheduleStatus: async (electionId) => {
    const response = await apiCall(`/results/${electionId}/schedule-status`, {
      method: 'GET',
    });
    return response;
  },

  getResultsByPosition: async (electionId, position) => {
    const response = await apiCall(`/results/${electionId}/position/${position}`, {
      method: 'GET',
    });
    return response;
  },

  declareResults: async (electionId) => {
    const response = await apiCall(`/results/${electionId}/declare`, {
      method: 'POST',
    });
    return response;
  },

  rejectVotes: async (electionId, flats, cancelElection = true) => {
    const response = await apiCall(`/results/${electionId}/reject`, {
      method: 'POST',
      body: JSON.stringify({ flats, cancelElection }),
    });
    return response;
  },

  getVotedFlats: async (electionId) => {
    const response = await apiCall(`/results/${electionId}/voted-flats`, {
      method: 'GET',
    });
    return response.flats || [];
  },

  getFinalizedResults: async (electionId) => {
    const response = await apiCall(`/results/${electionId}/finalized`, {
      method: 'GET',
    });
    return response.results || response;
  },
};

export default {
  voterAPI,
  candidateAPI,
  voteAPI,
  attendanceAPI,
  committeeAPI,
  resultsAPI,
  getAuthToken,
  setAuthToken,
  clearAuthToken,
};
