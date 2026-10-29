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
    localStorage.removeItem('eduqe_token');
    localStorage.removeItem('eduque_token');
    localStorage.removeItem('eduqe_user');
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

  if (authState.token) {
    reqHeaders['Authorization'] = `Bearer ${authState.token}`;
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
    authState.clearSession();
    window.dispatchEvent(new CustomEvent('auth:expired'));
    throw new Error('Your session has expired. Please sign in again.');
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
    throw new Error(errorMsg);
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
      return res.user;
    } catch (e) {
      authState.clearSession();
      return null;
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
  }
};
