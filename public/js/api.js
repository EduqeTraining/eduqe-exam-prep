// Eduqe API Client

const API_BASE = '/api';

export const authState = {
  token: localStorage.getItem('eduqe_token') || localStorage.getItem('eduque_token') || null,
  user: (() => {
    try {
      const u = localStorage.getItem('eduqe_user');
      return u ? JSON.parse(u) : null;
    } catch (e) {
      return null;
    }
  })(),

  setSession(token, user) {
    this.token = token;
    this.user = user;
    if (token) {
      localStorage.setItem('eduqe_token', token);
      localStorage.setItem('eduque_token', token);
      if (user) localStorage.setItem('eduqe_user', JSON.stringify(user));
    } else {
      localStorage.removeItem('eduqe_token');
      localStorage.removeItem('eduque_token');
      localStorage.removeItem('eduqe_user');
    }
  },

  clearSession() {
    this.token = null;
    this.user = null;
    this.clearAllIntervals();
    localStorage.removeItem('eduqe_token');
    localStorage.removeItem('eduque_token');
    localStorage.removeItem('eduqe_user');
  },

  _activeIntervals: new Set(),

  registerInterval(intervalId) {
    if (intervalId) {
      this._activeIntervals.add(intervalId);
    }
    return intervalId;
  },

  clearAllIntervals() {
    for (const id of this._activeIntervals) {
      clearInterval(id);
    }
    this._activeIntervals.clear();
  },

  isAuthenticated() {
    return Boolean(this.token);
  },

  isAdmin() {
    return this.user?.role === 'administrator';
  },

  isInstructor() {
    return this.user?.role === 'instructor';
  },

  isStudent() {
    return this.user?.role === 'student';
  }
};

export async function apiRequest(endpoint, { method = 'GET', body = null, headers = {} } = {}) {
  const reqHeaders = {
    'Content-Type': 'application/json',
    ...headers
  };

  const requestToken = authState.token;
  if (requestToken) {
    reqHeaders['Authorization'] = `Bearer ${requestToken}`;
  }

  const options = {
    method,
    headers: reqHeaders
  };

  if (body) {
    options.body = typeof body === 'string' ? body : JSON.stringify(body);
  }

  const response = await fetch(`${API_BASE}${endpoint}`, options);

  if (response.status === 401) {
    const isAuthRoute = endpoint === '/auth/login' || endpoint === '/auth/register' || endpoint === '/auth/logout';
    // Only clear session if the current token has not already been replaced by a newer login
    if (!isAuthRoute && authState.token === requestToken) {
      authState.clearSession();
      window.dispatchEvent(new CustomEvent('auth:expired'));
    }
    const err = new Error('Your session has expired. Please sign in again.');
    err.status = 401;
    err.isUnauthorized = true;
    throw err;
  }

  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('text/csv')) {
    return response.text();
  }

  let data = null;
  try {
    data = await response.json();
  } catch (e) {
    data = null;
  }

  if (!response.ok) {
    const errorMsg = data?.error || data?.message || `HTTP error ${response.status}`;
    const err = new Error(errorMsg);
    err.status = response.status;
    throw err;
  }

  return data;
}

export const api = {
  get: (endpoint) => apiRequest(endpoint, { method: 'GET' }),
  post: (endpoint, body) => apiRequest(endpoint, { method: 'POST', body }),
  put: (endpoint, body) => apiRequest(endpoint, { method: 'PUT', body }),
  delete: (endpoint) => apiRequest(endpoint, { method: 'DELETE' }),

  // Auth helpers
  async login(username, password) {
    const res = await apiRequest('/auth/login', {
      method: 'POST',
      body: { username, password }
    });
    authState.setSession(res.token, res.user);
    return res;
  },

  async register(registrationData) {
    const res = await apiRequest('/auth/register', {
      method: 'POST',
      body: registrationData
    });
    authState.setSession(res.token, res.user);
    return res;
  },

  async logout() {
    authState.clearAllIntervals();
    try {
      await apiRequest('/auth/logout', { method: 'POST' });
    } finally {
      authState.clearSession();
    }
  },

  async getMe() {
    if (!authState.token) return null;
    try {
      const res = await apiRequest('/auth/me');
      authState.user = res.user;
      if (res.user) localStorage.setItem('eduqe_user', JSON.stringify(res.user));
      return res.user;
    } catch (e) {
      // Only wipe session on an actual 401 unauthorized response, never on a transient 5xx/network hiccup
      if (e && (e.isUnauthorized || e.status === 401)) {
        authState.clearSession();
        return null;
      }
      return authState.user || null;
    }
  },

  // Instructor Helpers
  getInstructors: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return apiRequest(`/instructors${q ? `?${q}` : ''}`);
  },
  createInstructor: (data) => apiRequest('/instructors', { method: 'POST', body: data }),
  updateInstructor: (id, data) => apiRequest(`/instructors/${id}`, { method: 'PUT', body: data }),
  deleteInstructor: (id) => apiRequest(`/instructors/${id}`, { method: 'DELETE' }),
  getInstructorClasses: () => apiRequest('/instructor/classes'),
  getInstructorProgress: (classId = null, instructorId = null) => {
    const params = new URLSearchParams();
    if (classId) params.set('class_id', classId);
    if (instructorId) params.set('instructor_id', instructorId);
    const q = params.toString();
    return apiRequest(`/instructor/progress${q ? `?${q}` : ''}`);
  },
  submitSection: (attemptId, sectionName, answers = null, assessmentId = null, classId = null) => apiRequest(`/student/attempts/${attemptId}/submit-section`, { method: 'POST', body: { section_name: sectionName, answers, assessment_id: assessmentId, class_id: classId } }),
  resumeAttemptTimer: (attemptId, sectionName = null) => apiRequest(`/student/attempts/${attemptId}/resume-timer`, { method: 'POST', body: { section_name: sectionName } }),
  getAttemptUnlockStatus: (attemptId) => apiRequest(`/student/attempts/${attemptId}/unlock-status`),
  getActiveAttempt: (assessmentId) => apiRequest(`/student/assessments/${assessmentId}/active-attempt`),
  setUnlockedSections: (classId, unlockedSections) => apiRequest(`/instructor/classes/${classId}/unlocked-sections`, { method: 'PUT', body: { unlocked_sections: unlockedSections } }),
  getUnlockedSections: (classId) => apiRequest(`/instructor/classes/${classId}/unlocked-sections`),
  getClassAssessmentConfig: (classId) => apiRequest(`/instructor/classes/${classId}/assessment-settings`),
  updateClassAssessmentConfig: (classId, data) => apiRequest(`/instructor/classes/${classId}/assessment-settings`, { method: 'POST', body: data })
};
