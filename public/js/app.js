// Eduqe - Main Client Application & Router

import { api, authState } from './api.js';
import { renderAdminDashboard } from './views/adminDashboard.js';
import { renderCoursesView } from './views/coursesView.js';
import { renderClassesView } from './views/classesView.js';
import { renderStudentsView } from './views/studentsView.js';
import { renderQuestionBank } from './views/questionBankView.js';
import { renderQuestionEditor } from './views/questionEditorView.js';
import { renderPoolsView } from './views/poolsView.js';
import { renderAssessmentsView } from './views/assessmentsView.js';
import { renderAssessmentBuilder } from './views/assessmentBuilderView.js';
import { renderReportsView } from './views/reportsView.js';
import { renderAuditView } from './views/auditView.js';
import { renderStudentDashboard } from './views/studentDashboardView.js';
import { renderAssessmentPlayer } from './views/assessmentPlayerView.js';
import { renderInstructorsView } from './views/instructorsView.js';
import { renderInstructorDashboard } from './views/instructorDashboardView.js';

// DOM Elements
const appShell = document.getElementById('app-shell');
const sidebar = document.getElementById('sidebar');
const navList = document.getElementById('nav-list');
const topNavbar = document.getElementById('top-navbar');
const pageContainer = document.getElementById('page-container');
const loginContainer = document.getElementById('login-container');
const changePasswordModal = document.getElementById('modal-change-password');
const toastContainer = document.getElementById('toast-container');

// Router definition
class Router {
  constructor() {
    this.routes = {};
    window.addEventListener('hashchange', () => this.handleRoute());
  }

  navigate(path, params = null) {
    let hash = path.startsWith('#') ? path.slice(1) : path;
    if (params && typeof params === 'object') {
      const qs = new URLSearchParams(params).toString();
      if (qs) {
        hash = `${hash.split('?')[0]}?${qs}`;
      }
    }
    window.location.hash = `#${hash}`;
  }

  getRouteData() {
    const raw = window.location.hash.slice(1) || '';
    const [pathPart, queryPart] = raw.split('?');
    const params = new URLSearchParams(queryPart || '');
    let defaultPath = 'student';
    if (authState.isAdmin()) defaultPath = 'dashboard';
    else if (authState.isInstructor()) defaultPath = 'instructor';

    return {
      path: pathPart || defaultPath,
      params
    };
  }

  async handleRoute() {
    const { path, params } = this.getRouteData();
    if (!authState.isAuthenticated()) {
      showLoginView(path === 'register' || path === 'signup' ? 'register' : 'login');
      return;
    }

    if (path === 'login' || path === 'register' || path === 'signup') {
      let dest = 'student';
      if (authState.isAdmin()) dest = 'dashboard';
      else if (authState.isInstructor()) dest = 'instructor';
      this.navigate(dest);
      return;
    }

    updateNavigationUI(path);

    // Instructor routes
    if (authState.isInstructor()) {
      renderInstructorDashboard(pageContainer, this);
      return;
    }

    // Enforce role guard
    if (authState.isStudent()) {
      if (path.startsWith('exam/')) {
        const assessmentId = path.split('/')[1];
        const classId = params.get('class');
        const forceRestart = params.get('restart') === '1' || params.get('restart') === 'true';
        renderAssessmentPlayer(pageContainer, {
          assessmentId,
          classId,
          forceRestart,
          onExit: () => this.navigate('student')
        });
        return;
      }
      if (path.startsWith('exam-attempt/')) {
        const attemptId = path.split('/')[1];
        renderAssessmentPlayer(pageContainer, {
          attemptId,
          onExit: () => this.navigate('student')
        });
        return;
      }
      // Default student route
      renderStudentDashboard(pageContainer, this);
      return;
    }

    // Administrator routes
    switch (path) {
      case 'dashboard':
      case 'admin':
        renderAdminDashboard(pageContainer, this);
        break;

      case 'courses':
        renderCoursesView(pageContainer, this, { action: params.get('action') });
        break;

      case 'classes':
        renderClassesView(pageContainer, this, { action: params.get('action') });
        break;

      case 'students':
        renderStudentsView(pageContainer, this, { action: params.get('action') });
        break;

      case 'instructors':
        renderInstructorsView(pageContainer, this);
        break;

      case 'instructor':
        renderInstructorDashboard(pageContainer, this);
        break;

      case 'question-bank':
        renderQuestionBank(pageContainer);
        break;

      case 'question-editor':
        renderQuestionEditor(pageContainer, {
          questionId: params.get('id'),
          defaultCourseId: params.get('course_id'),
          onSaved: () => this.navigate('question-bank'),
          onCancel: () => this.navigate('question-bank')
        });
        break;

      case 'pools':
        renderPoolsView(pageContainer);
        break;

      case 'assessments':
        renderAssessmentsView(pageContainer, this);
        break;

      case 'assessment-builder':
        renderAssessmentBuilder(pageContainer, {
          assessmentId: params.get('id'),
          onSaved: () => this.navigate('assessments')
        });
        break;

      case 'reports':
        renderReportsView(pageContainer);
        break;

      case 'audit':
        renderAuditView(pageContainer);
        break;

      default:
        renderAdminDashboard(pageContainer, this);
        break;
    }
  }
}

export const router = new Router();

// Toast helper
export function showToast(message, type = 'info') {
  if (!toastContainer) return;
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <span>${escapeHtml(message)}</span>
    <button type="button" style="background:transparent; border:none; color:inherit; cursor:pointer; font-weight:bold; margin-left:1rem;">&times;</button>
  `;
  toast.querySelector('button').onclick = () => toast.remove();
  toastContainer.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// Update Active Nav & Navigation Bar
function updateNavigationUI(currentPath) {
  loginContainer.style.display = 'none';
  appShell.style.display = 'flex';

  // Build nav list based on role
  if (authState.isAdmin()) {
    navList.innerHTML = `
      <li class="nav-item">
        <a href="#dashboard" class="nav-link ${currentPath === 'dashboard' || currentPath === 'admin' ? 'active' : ''}">
          <span style="font-size:1.1rem;">&#x1F4CA;</span> Dashboard
        </a>
      </li>
      <li class="nav-item">
        <a href="#courses" class="nav-link ${currentPath === 'courses' ? 'active' : ''}">
          <span style="font-size:1.1rem;">&#x1F4DA;</span> Courses
        </a>
      </li>
      <li class="nav-item">
        <a href="#classes" class="nav-link ${currentPath === 'classes' ? 'active' : ''}">
          <span style="font-size:1.1rem;">&#x1F3EB;</span> Classes
        </a>
      </li>
      <li class="nav-item">
        <a href="#students" class="nav-link ${currentPath === 'students' ? 'active' : ''}">
          <span style="font-size:1.1rem;">&#x1F465;</span> Students
        </a>
      </li>
      <li class="nav-item">
        <a href="#instructors" class="nav-link ${currentPath === 'instructors' ? 'active' : ''}">
          <span style="font-size:1.1rem;">&#x1F468;&#x200D;&#x1F3EB;</span> Instructors
        </a>
      </li>
      <li class="nav-item">
        <a href="#question-bank" class="nav-link ${currentPath === 'question-bank' || currentPath === 'question-editor' ? 'active' : ''}">
          <span style="font-size:1.1rem;">&#x1F9E0;</span> Question Bank
        </a>
      </li>
      <li class="nav-item">
        <a href="#pools" class="nav-link ${currentPath === 'pools' ? 'active' : ''}">
          <span style="font-size:1.1rem;">&#x1F3B2;</span> Question Pools
        </a>
      </li>
      <li class="nav-item">
        <a href="#assessments" class="nav-link ${currentPath === 'assessments' || currentPath === 'assessment-builder' ? 'active' : ''}">
          <span style="font-size:1.1rem;">&#x1F4CB;</span> Assessments
        </a>
      </li>
      <li class="nav-item">
        <a href="#reports" class="nav-link ${currentPath === 'reports' ? 'active' : ''}">
          <span style="font-size:1.1rem;">&#x1F4C8;</span> Reports & Analytics
        </a>
      </li>
      <li class="nav-item">
        <a href="#audit" class="nav-link ${currentPath === 'audit' ? 'active' : ''}">
          <span style="font-size:1.1rem;">&#x1F6E1;&#xFE0F;</span> Audit Logs
        </a>
      </li>
    `;
  } else if (authState.isInstructor()) {
    // Instructor navigation
    navList.innerHTML = `
      <li class="nav-item">
        <a href="#instructor" class="nav-link ${currentPath === 'instructor' || currentPath === 'dashboard' ? 'active' : ''}">
          <span style="font-size:1.1rem;">&#x1F4CA;</span> Cohort Progress &amp; Stats
        </a>
      </li>
    `;
  } else {
    // Student navigation
    navList.innerHTML = `
      <li class="nav-item">
        <a href="#student" class="nav-link ${currentPath === 'student' || currentPath === 'dashboard' ? 'active' : ''}">
          <span style="font-size:1.1rem;">&#x1F393;</span> My Dashboard
        </a>
      </li>
    `;
  }

  // Update top bar
  const user = authState.user;
  const portalLabel = authState.isAdmin()
    ? 'Administration Portal'
    : authState.isInstructor()
      ? 'Instructor-Led Training Portal'
      : 'Student Learning Portal';

  topNavbar.innerHTML = `
    <div style="display:flex; align-items:center; gap:0.85rem; flex-wrap:wrap;">
      <span style="font-family:var(--font-heading); font-weight:800; color:var(--text-main); font-size:0.925rem; letter-spacing:-0.01em;">
        ${portalLabel}
      </span>
      <span class="badge badge-primary" style="font-size:0.65rem; text-transform:uppercase; letter-spacing:0.06em;">
        &#x26A1; Eduqe Assessment Platform
      </span>
    </div>
    <div style="display:flex; align-items:center; gap:1rem;">
      <button type="button" class="btn btn-secondary btn-sm" id="btn-toggle-theme" title="Toggle Light/Dark Theme">
        ${document.documentElement.getAttribute('data-theme') === 'dark' ? '&#x2600;&#xFE0F; Light' : '&#x1F319; Dark'}
      </button>
      <div style="display:flex; align-items:center; gap:0.6rem; padding-left:0.65rem; border-left:1px solid var(--border);">
        <div style="width:34px; height:34px; border-radius:50%; background:var(--brand-lime); color:#202020; display:flex; align-items:center; justify-content:center; font-weight:800; font-family:var(--font-heading); font-size:0.85rem; box-shadow:0 0 10px rgba(181,244,74,0.35);">
          ${escapeHtml(user ? (user.first_name?.[0] || user.username?.[0] || 'U').toUpperCase() : 'U')}
        </div>
        <div style="display:flex; flex-direction:column; line-height:1.2;">
          <span style="font-weight:700; font-size:0.85rem; font-family:var(--font-heading);">${escapeHtml(user ? `${user.first_name} ${user.surname}` : '')}</span>
          <span style="font-size:0.725rem; color:var(--text-muted); text-transform:capitalize;">${escapeHtml(user?.role || '')}</span>
        </div>
      </div>
      <button type="button" class="btn btn-secondary btn-sm" id="btn-logout" title="Sign Out">
        Sign Out
      </button>
    </div>
  `;

  // Top navbar event listeners
  topNavbar.querySelector('#btn-toggle-theme').onclick = toggleTheme;
  topNavbar.querySelector('#btn-logout').onclick = async () => {
    await api.logout();
    router.navigate('login');
    showLoginView('login');
  };
}

// Authentication & Student Registration View (Motivated by https://eduqe.co.za/)
function showLoginView(activeTab = 'login') {
  appShell.style.display = 'none';
  loginContainer.style.display = 'flex';

  const isLogin = activeTab === 'login';

  loginContainer.innerHTML = `
    <!-- Background Speech Bubble Contours (eduqe.co.za Brand Watermark) -->
    <div class="login-bg-decorations" aria-hidden="true">
      <svg class="login-contour-bubble" viewBox="0 0 600 600" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M 300 40 C 443.59 40 560 156.41 560 300 C 560 362.8 537.6 420.3 500 464.8 L 575 560 L 447.8 522.5 C 403.4 546.5 352.5 560 300 560 C 156.41 560 40 443.59 40 300 C 40 156.41 156.41 40 300 40 Z" stroke="#B5F44A" stroke-width="2.5" opacity="0.22"/>
        <path d="M 300 110 C 404.93 110 490 195.07 490 300 C 490 345.8 473.7 387.8 446.3 420.2 L 505 490 L 407.9 462.6 C 375.5 480.1 338.4 490 300 490 C 195.07 490 110 404.93 110 300 C 110 195.07 195.07 110 300 110 Z" stroke="#B5F44A" stroke-width="1.8" opacity="0.14"/>
      </svg>
    </div>

    <div class="auth-showcase-grid">
      <!-- Left Column: eduqe.co.za Hero Brand Showcase -->
      <div class="eduqe-auth-hero">
        <div style="margin-bottom:1.15rem;">
          <img src="./Photos/Eduqe-Logo-2025.webp" alt="Eduqe Logo" class="eduqe-hero-logo" width="185" height="46" />
        </div>
        <div class="eduqe-kicker">
          <span>&#x26A1;</span> EXPERTS IN IT TRAINING &bull; EDUQE ASSESSMENT SYSTEM
        </div>
        <h1>
          Build Capability.<br>
          <span class="lime-accent">Master Your Certification.</span>
        </h1>
        <p class="hero-lead">
          Welcome to the official <strong>Eduqe</strong> Exam Preparation &amp; Learning Assessment Platform. Prepare for globally recognized certifications across world-leading Multi-OEM technology ecosystems.
        </p>

        <div class="eduqe-pillars-grid">
          <div class="eduqe-pillar-card">
            <strong>&#x1F3AF; Certification Exam Readiness</strong>
            <span>Timed practice assessments, instant scoring, and detailed topic feedback built by Eduqe.</span>
          </div>
          <div class="eduqe-pillar-card">
            <strong>&#x1F468;&#x200D;&#x1F3EB; Instructor-Led &amp; Hybrid</strong>
            <span>Live cohort tracking, class access codes, and guided weak-spot analytics.</span>
          </div>
          <div class="eduqe-pillar-card">
            <strong>&#x1F310; Multi-OEM Ecosystems</strong>
            <span>Cloud, Cyber Security, AI, Data Analytics, DevOps &amp; Software Engineering.</span>
          </div>
          <div class="eduqe-pillar-card">
            <strong>&#x1F3C6; B-BBEE Level 1 Partner</strong>
            <span>Empowering South African workforce development &amp; technical capability.</span>
          </div>
        </div>

        <div>
          <div style="font-family:var(--font-heading); font-size:0.7rem; font-weight:800; letter-spacing:0.1em; color:rgba(255,255,255,0.6); text-transform:uppercase;">
            Accredited Multi-OEM Certification Ecosystems
          </div>
          <div class="oem-pill-strip">
            <span class="oem-pill">Microsoft</span>
            <span class="oem-pill">AWS</span>
            <span class="oem-pill">CompTIA</span>
            <span class="oem-pill">Google Cloud</span>
            <span class="oem-pill">CertNexus</span>
            <span class="oem-pill">Linux (LPI)</span>
            <span class="oem-pill">ITIL</span>
            <span class="oem-pill">Python</span>
          </div>
        </div>

        <div style="margin-top:1.75rem; padding-top:1rem; border-top:1px solid rgba(255,255,255,0.1); font-size:0.75rem; color:rgba(255,255,255,0.65); display:flex; flex-wrap:wrap; gap:1rem;">
          <span>&#x1F4CD; Eco Court Office Park, Highveld, Centurion</span>
          <span>&#x2709;&#xFE0F; info@eduqe.co.za</span>
          <span>&#x1F4DE; +27 12 051 3410</span>
        </div>
      </div>

      <!-- Right Column: Authentication & Student Registration Card -->
      <div class="auth-card-wrapper">
        <div class="card" style="width:100%; max-width:${isLogin ? '480px' : '580px'}; padding:2.35rem; transition:max-width 0.25s ease;">
          <div style="text-align:center; margin-bottom:1.35rem;">
            <div style="display:inline-flex; flex-direction:column; align-items:center; margin-bottom:0.5rem;">
              <div class="eduqe-logo-plinth">
                <img src="./Photos/Eduqe-Logo-2025.webp" alt="Eduqe Logo" class="eduqe-logo" width="168" height="42" />
              </div>
              <div style="font-family:'Montserrat', sans-serif; font-size:0.625rem; font-weight:800; letter-spacing:0.25em; color:var(--text-muted); text-transform:uppercase; margin-top:6px;">
                EXPERTS IN IT TRAINING
              </div>
            </div>
            <p class="form-hint" style="font-size:0.85rem; margin-top:0.15rem;">
              Exam Preparation &amp; Certification Portal
            </p>
          </div>

          <!-- Segmented Tab Switcher -->
          <div style="display:grid; grid-template-columns:1fr 1fr; background:var(--surface-subtle); padding:4px; border-radius:var(--radius-md); margin-bottom:1.4rem; border:1px solid var(--border); gap:4px;">
            <button type="button" id="tab-btn-login" class="btn ${isLogin ? 'btn-primary' : 'btn-secondary'}" style="padding:0.6rem; font-size:0.85rem; font-weight:800; border:none; ${isLogin ? '' : 'background:transparent;'}">
              Sign In
            </button>
            <button type="button" id="tab-btn-register" class="btn ${!isLogin ? 'btn-primary' : 'btn-secondary'}" style="padding:0.6rem; font-size:0.85rem; font-weight:800; border:none; ${!isLogin ? '' : 'background:transparent;'}">
              Student Register
            </button>
          </div>

          ${isLogin ? renderLoginFormHtml() : renderRegisterFormHtml()}
        </div>
      </div>
    </div>
  `;

  attachAuthHandlers(isLogin);
}

function renderLoginFormHtml() {
  return `
    <form id="login-form">
      <div class="form-group" style="margin-bottom:1rem;">
        <label class="form-label" for="login-username">Username or Email</label>
        <input 
          type="text" 
          id="login-username" 
          class="form-control" 
          placeholder="Enter username or email" 
          required 
          autocomplete="username" 
          autofocus
        />
      </div>

      <div class="form-group" style="margin-bottom:1.25rem;">
        <label class="form-label" for="login-password">Password</label>
        <input 
          type="password" 
          id="login-password" 
          class="form-control" 
          placeholder="Enter password" 
          required 
          autocomplete="current-password"
        />
      </div>

      <div id="login-error-alert" style="margin-bottom:1rem; display:none;"></div>

      <button type="submit" class="btn btn-primary" id="btn-login-submit" style="width:100%; padding:0.75rem; font-weight:700;">
        Sign In &rarr;
      </button>
    </form>

    <div style="text-align:center; margin-top:1.25rem; font-size:0.875rem; color:var(--text-muted);">
      Don't have an account yet? 
      <a href="#register" id="link-switch-register" style="color:var(--primary); font-weight:700; text-decoration:underline;">
        Register as a student
      </a>
    </div>
  `;
}

function renderRegisterFormHtml() {
  return `
    <div style="margin-bottom:1.25rem;">
      <h2 style="font-size:1.15rem; font-weight:700; margin-bottom:0.25rem;">Create Your Student Account</h2>
      <p class="form-hint" style="font-size:0.85rem; margin-bottom:0;">
        Sign up to enroll in certification courses, practice assessments, and track your progress.
      </p>
    </div>

    <form id="register-form">
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.75rem; margin-bottom:0.85rem;">
        <div class="form-group">
          <label class="form-label" for="reg-first-name">First Name <span style="color:var(--danger);">*</span></label>
          <input 
            type="text" 
            id="reg-first-name" 
            class="form-control" 
            placeholder="e.g. Jane" 
            required 
            autocomplete="given-name" 
            autofocus
          />
        </div>
        <div class="form-group">
          <label class="form-label" for="reg-surname">Surname <span style="color:var(--danger);">*</span></label>
          <input 
            type="text" 
            id="reg-surname" 
            class="form-control" 
            placeholder="e.g. Doe" 
            required 
            autocomplete="family-name"
          />
        </div>
      </div>

      <div class="form-group" style="margin-bottom:0.85rem;">
        <label class="form-label" for="reg-email">Email Address <span style="color:var(--danger);">*</span></label>
        <input 
          type="email" 
          id="reg-email" 
          class="form-control" 
          placeholder="e.g. jane.doe@example.com" 
          required 
          autocomplete="email"
        />
      </div>

      <div class="form-group" style="margin-bottom:0.85rem;">
        <label class="form-label" for="reg-username">
          Username <span style="color:var(--text-muted); font-weight:normal; font-size:0.8rem;">(Optional)</span>
        </label>
        <input 
          type="text" 
          id="reg-username" 
          class="form-control" 
          placeholder="e.g. jane.doe (leave blank to auto-generate)" 
          autocomplete="username"
        />
        <div class="form-hint" style="font-size:0.75rem; margin-top:0.25rem;">
          Leave empty to automatically generate a username from your first name and surname.
        </div>
      </div>

      <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.75rem; margin-bottom:0.85rem;">
        <div class="form-group">
          <label class="form-label" for="reg-password">Password <span style="color:var(--danger);">*</span></label>
          <input 
            type="password" 
            id="reg-password" 
            class="form-control" 
            placeholder="Min. 6 chars" 
            minlength="6" 
            required 
            autocomplete="new-password"
          />
        </div>
        <div class="form-group">
          <label class="form-label" for="reg-confirm-password">Confirm Password <span style="color:var(--danger);">*</span></label>
          <input 
            type="password" 
            id="reg-confirm-password" 
            class="form-control" 
            placeholder="Re-enter password" 
            minlength="6" 
            required 
            autocomplete="new-password"
          />
        </div>
      </div>

      <!-- Course Access Code Promotion Box -->
      <div style="background:var(--primary-light); border:1px solid var(--primary-border); border-radius:var(--radius-md); padding:0.85rem 1rem; margin-bottom:0.85rem;">
        <label class="form-label" for="reg-course-code" style="color:var(--primary); font-weight:700; display:flex; align-items:center; gap:0.4rem; margin-bottom:0.35rem;">
          <span>&#x1F3F7;&#xFE0F;</span> Course Access Code <span style="font-weight:normal; font-size:0.8rem; color:var(--text-muted);">(Optional)</span>
        </label>
        <input 
          type="text" 
          id="reg-course-code" 
          class="form-control" 
          placeholder="e.g. az-900 or AZ104-CENTURION-01" 
          style="text-transform:uppercase; font-weight:700; letter-spacing:0.04em;"
        />
        <div class="form-hint" style="font-size:0.75rem; margin-top:0.35rem; color:var(--primary);">
          Enter a course code provided by your instructor to instantly enroll and access practice assessments.
        </div>
      </div>

      <div class="form-group" style="margin-bottom:1.15rem;">
        <label class="form-label" for="reg-student-number">
          Student / ID Number <span style="color:var(--text-muted); font-weight:normal; font-size:0.8rem;">(Optional)</span>
        </label>
        <input 
          type="text" 
          id="reg-student-number" 
          class="form-control" 
          placeholder="e.g. STU-2026-001"
        />
      </div>

      <div id="reg-error-alert" style="margin-bottom:1rem; display:none;"></div>

      <button type="submit" class="btn btn-primary" id="btn-reg-submit" style="width:100%; padding:0.8rem; font-weight:700; font-size:0.95rem;">
        Create Student Account &rarr;
      </button>
    </form>

    <div style="text-align:center; margin-top:1.25rem; font-size:0.875rem; color:var(--text-muted);">
      Already have an account? 
      <a href="#login" id="link-switch-login" style="color:var(--primary); font-weight:700; text-decoration:underline;">
        Sign in here
      </a>
    </div>
  `;
}

function attachAuthHandlers(isLogin) {
  // Tab switcher handlers
  const tabLoginBtn = loginContainer.querySelector('#tab-btn-login');
  const tabRegisterBtn = loginContainer.querySelector('#tab-btn-register');

  if (tabLoginBtn) {
    tabLoginBtn.onclick = () => {
      router.navigate('login');
      showLoginView('login');
    };
  }
  if (tabRegisterBtn) {
    tabRegisterBtn.onclick = () => {
      router.navigate('register');
      showLoginView('register');
    };
  }

  if (isLogin) {
    const form = loginContainer.querySelector('#login-form');
    const userInput = loginContainer.querySelector('#login-username');
    const passInput = loginContainer.querySelector('#login-password');
    const alertBox = loginContainer.querySelector('#login-error-alert');
    const submitBtn = loginContainer.querySelector('#btn-login-submit');
    const linkRegister = loginContainer.querySelector('#link-switch-register');

    if (linkRegister) {
      linkRegister.onclick = (e) => {
        e.preventDefault();
        router.navigate('register');
        showLoginView('register');
      };
    }

    async function performLogin(username, password) {
      alertBox.style.display = 'none';
      submitBtn.disabled = true;
      submitBtn.textContent = 'Verifying credentials...';

      try {
        const res = await api.login(username, password);

        // Check if password change is mandated (Section 3)
        if (res.user?.must_change_password) {
          showMandatoryPasswordChange(res.user);
          return;
        }

        // Route to destination
        if (res.user.role === 'administrator') {
          router.navigate('dashboard');
        } else if (res.user.role === 'instructor') {
          router.navigate('instructor');
        } else {
          router.navigate('student');
        }
      } catch (err) {
        alertBox.style.display = 'block';
        alertBox.innerHTML = `
          <div class="alert alert-danger" style="padding:0.6rem 0.85rem; border-radius:var(--radius-sm); font-size:0.85rem;">
            ${escapeHtml(err.message)}
          </div>
        `;
        submitBtn.disabled = false;
        submitBtn.textContent = 'Sign In →';
      }
    }

    form.onsubmit = (e) => {
      e.preventDefault();
      performLogin(userInput.value.trim(), passInput.value);
    };
  } else {
    // Student Registration Handlers
    const regForm = loginContainer.querySelector('#register-form');
    const regFirst = loginContainer.querySelector('#reg-first-name');
    const regSur = loginContainer.querySelector('#reg-surname');
    const regEmail = loginContainer.querySelector('#reg-email');
    const regUser = loginContainer.querySelector('#reg-username');
    const regPass = loginContainer.querySelector('#reg-password');
    const regConfirm = loginContainer.querySelector('#reg-confirm-password');
    const regCode = loginContainer.querySelector('#reg-course-code');
    const regNum = loginContainer.querySelector('#reg-student-number');
    const regAlert = loginContainer.querySelector('#reg-error-alert');
    const regSubmit = loginContainer.querySelector('#btn-reg-submit');
    const linkLogin = loginContainer.querySelector('#link-switch-login');

    if (linkLogin) {
      linkLogin.onclick = (e) => {
        e.preventDefault();
        router.navigate('login');
        showLoginView('login');
      };
    }

    regForm.onsubmit = async (e) => {
      e.preventDefault();
      regAlert.style.display = 'none';

      const firstName = regFirst.value.trim();
      const surname = regSur.value.trim();
      const email = regEmail.value.trim();
      const username = regUser.value.trim() || null;
      const password = regPass.value;
      const confirmPassword = regConfirm.value;
      const courseCode = regCode.value.trim() || null;
      const studentNumber = regNum.value.trim() || null;

      // Validation
      if (password !== confirmPassword) {
        regAlert.style.display = 'block';
        regAlert.innerHTML = `
          <div class="alert alert-danger" style="padding:0.6rem 0.85rem; border-radius:var(--radius-sm); font-size:0.85rem;">
            Passwords do not match. Please ensure both password fields are identical.
          </div>
        `;
        regConfirm.focus();
        return;
      }

      if (password.length < 6) {
        regAlert.style.display = 'block';
        regAlert.innerHTML = `
          <div class="alert alert-danger" style="padding:0.6rem 0.85rem; border-radius:var(--radius-sm); font-size:0.85rem;">
            Password must be at least 6 characters long.
          </div>
        `;
        regPass.focus();
        return;
      }

      regSubmit.disabled = true;
      regSubmit.textContent = 'Creating Student Account...';

      try {
        const res = await api.register({
          first_name: firstName,
          surname: surname,
          email: email,
          username: username,
          password: password,
          student_number: studentNumber,
          course_code: courseCode
        });

        if (res.redeemedCourse) {
          showToast(`Welcome to Eduqe, ${res.user.first_name}! You are enrolled in ${res.redeemedCourse.course?.name || 'your course'}.`, 'success');
        } else {
          showToast(`Welcome to Eduqe, ${res.user.first_name}! Your student account is ready.`, 'success');
        }

        router.navigate('student');
      } catch (err) {
        regAlert.style.display = 'block';
        regAlert.innerHTML = `
          <div class="alert alert-danger" style="padding:0.6rem 0.85rem; border-radius:var(--radius-sm); font-size:0.85rem;">
            ${escapeHtml(err.message)}
          </div>
        `;
        regSubmit.disabled = false;
        regSubmit.textContent = 'Create Student Account →';
      }
    };
  }
}

// Mandatory Password Change Modal (Section 3)
function showMandatoryPasswordChange(user) {
  changePasswordModal.innerHTML = `
    <div class="modal-header">
      <h3 style="font-size:1.15rem; font-weight:700;">Mandatory Password Change Required</h3>
      <button type="button" class="btn btn-secondary btn-sm" id="btn-close-change-pwd" title="Cancel and Exit">&times;</button>
    </div>
    <div class="modal-body">
      <p class="form-hint" style="margin-bottom:1.25rem;">
        Welcome to Eduqe, <strong>${escapeHtml(user.first_name)}</strong>! For security purposes, your temporary password must be changed before accessing your courses and assessments.
      </p>
      <form id="form-must-change-password">
        <div class="form-group" style="margin-bottom:1rem;">
          <label class="form-label" for="mp-current">Current Temporary Password</label>
          <input type="password" id="mp-current" class="form-control" required />
        </div>
        <div class="form-group" style="margin-bottom:1rem;">
          <label class="form-label" for="mp-new">New Password (Min 8 characters)</label>
          <input type="password" id="mp-new" class="form-control" minlength="8" required />
        </div>
        <div class="form-group" style="margin-bottom:1.25rem;">
          <label class="form-label" for="mp-confirm">Confirm New Password</label>
          <input type="password" id="mp-confirm" class="form-control" minlength="8" required />
        </div>
        <div id="mp-alert" style="margin-bottom:1rem; display:none;"></div>
        <div class="modal-footer" style="padding:0; margin-top:1.25rem; display:flex; justify-content:flex-end; gap:0.75rem;">
          <button type="button" class="btn btn-secondary" id="btn-cancel-change-pwd">Cancel</button>
          <button type="submit" class="btn btn-primary" id="btn-save-new-password">Update Password & Continue &rarr;</button>
        </div>
      </form>
    </div>
  `;

  if (typeof changePasswordModal.showModal === 'function') {
    changePasswordModal.showModal();
  }

  function handleCancelPasswordChange() {
    if (typeof changePasswordModal.close === 'function') {
      changePasswordModal.close();
    }
    // Return to sign in view cleanly
    api.logout().catch(() => {});
    showToast('Password setup cancelled.', 'info');
    const hash = (window.location.hash || '').replace('#', '');
  showLoginView(hash === 'register' || hash === 'signup' ? 'register' : 'login');
  }

  const closeBtn = changePasswordModal.querySelector('#btn-close-change-pwd');
  const cancelBtn = changePasswordModal.querySelector('#btn-cancel-change-pwd');
  if (closeBtn) closeBtn.onclick = handleCancelPasswordChange;
  if (cancelBtn) cancelBtn.onclick = handleCancelPasswordChange;

  changePasswordModal.oncancel = (e) => {
    e.preventDefault();
    handleCancelPasswordChange();
  };

  const mpForm = changePasswordModal.querySelector('#form-must-change-password');
  const alertBox = changePasswordModal.querySelector('#mp-alert');

  mpForm.onsubmit = async (e) => {
    e.preventDefault();
    const current = changePasswordModal.querySelector('#mp-current').value;
    const newPass = changePasswordModal.querySelector('#mp-new').value;
    const confirmPass = changePasswordModal.querySelector('#mp-confirm').value;

    if (newPass !== confirmPass) {
      alertBox.style.display = 'block';
      alertBox.innerHTML = '<div class="alert alert-danger" style="padding:0.5rem; font-size:0.85rem;">New passwords do not match.</div>';
      return;
    }

    try {
      await api.post('/auth/change-password', {
        current_password: current,
        new_password: newPass
      });

      if (authState.user) {
        authState.user.must_change_password = 0;
      }

      if (typeof changePasswordModal.close === 'function') {
        changePasswordModal.close();
      }

      showToast('Password successfully changed!', 'success');
      if (user.role === 'instructor') {
        router.navigate('instructor');
      } else if (user.role === 'administrator') {
        router.navigate('dashboard');
      } else {
        router.navigate('student');
      }
    } catch (err) {
      alertBox.style.display = 'block';
      alertBox.innerHTML = `<div class="alert alert-danger" style="padding:0.5rem; font-size:0.85rem;">${escapeHtml(err.message)}</div>`;
    }
  };
}

// Light / Dark Theme Toggle
function initTheme() {
  const savedTheme = localStorage.getItem('eduque-theme') || 'light';
  document.documentElement.setAttribute('data-theme', savedTheme);
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'light';
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('eduque-theme', next);
  const btn = document.getElementById('btn-toggle-theme');
  if (btn) {
    btn.innerHTML = next === 'dark' ? '&#x2600;&#xFE0F; Light' : '&#x1F319; Dark';
  }
}

// App Initialization
// Global Modal Cancellation: Clicking outside any open dialog backdrop exits/cancels it
document.addEventListener('click', (e) => {
  if (e.target && e.target.nodeName === 'DIALOG' && e.target.open) {
    const rect = e.target.getBoundingClientRect();
    const isInside = (
      e.clientX >= rect.left &&
      e.clientX <= rect.right &&
      e.clientY >= rect.top &&
      e.clientY <= rect.bottom
    );
    if (!isInside) {
      if (e.target.id === 'modal-change-password') {
        if (typeof e.target.close === 'function') e.target.close();
        api.logout().catch(() => {});
        showToast('Password setup cancelled.', 'info');
        showLoginView('login');
      } else {
        if (typeof e.target.close === 'function') e.target.close();
      }
    }
  }
});

async function initApp() {
  initTheme();

  // Listen for session expiration
  window.addEventListener('auth:expired', () => {
    showLoginView('login');
  });

  // Verify existing session
  if (authState.token) {
    try {
      const user = await api.getMe();
      if (user) {
        if (user.must_change_password) {
          showMandatoryPasswordChange(user);
        } else {
          router.handleRoute();
        }
        return;
      }
    } catch (e) {
      // Session invalid
    }
  }

  const hash = (window.location.hash || '').replace('#', '');
  showLoginView(hash === 'register' || hash === 'signup' ? 'register' : 'login');
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

initApp();
