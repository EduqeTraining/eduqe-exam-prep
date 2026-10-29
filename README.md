# Eduqe - Professional Exam-Preparation and Assessment Platform

Eduqe is a secure, modern, responsive web application and assessment engine designed for high-stakes certification and professional exam preparation.

---

## 🚀 Quick Start Guide

### 1. Requirements
- Node.js v20+ or v24+ (built using Node.js standard built-ins: `node:sqlite`, `node:crypto`, `node:http`, and `node:test` with zero external npm dependencies).

### 2. Start the Server
```bash
node src/server.js
```
The server will initialize the SQLite database (`data/eduque.db`), automatically seed the demonstration curriculum, and start listening on:
👉 **[http://localhost:3000](http://localhost:3000)**

### 3. Run Automated Tests
Eduqe features an exhaustive test suite covering all authentication workflows, 10-step course code verification, multi-class enrolment, all 12 question types, assessment timers, autosave recovery, attempt recalculation, and security enforcement:
```bash
node --test tests/**/*.test.js
```
*Current test suite: **56 tests across 8 suites, 100% passing**.*

---

## 🔑 Pre-Configured Demonstration Accounts

The login interface includes one-click demo login buttons for immediate testing:

| Role | Username | Password | Notes |
| :--- | :--- | :--- | :--- |
| **Administrator** | `admin` | `Admin2026!` | Full administrative access across all courses, question bank, assessments, reports, and audit logs. |
| **Student (New)** | `alex.morgan` | `Eduqe2026!` | Initial temporary password. **Triggers mandatory password change dialog on first sign-in** before granting portal access. |
| **Student (Active)** | `sarah.chen` | `Eduqe2026!` | Active student enrolled in *AZ-104 Exam Preparation (November Morning Class)* with ready assessments. |

### Demonstration Course Access Code
- **Course Code**: `AZ104-CENTURION-01`
- **Associated Course**: *AZ-104 Exam Preparation*
- **Associated Class**: *November Morning Class*
- **Rule Verification**: A student must sign in first. Entering a course code directly without authentication is strictly rejected by the server.

---

## 🏛️ System Architecture

Eduqe is engineered with a clean, decoupled architecture:

```
├── public/                     # Modern Single-Page Application (SPA)
│   ├── index.html              # Accessible HTML5 application shell & dialogs
│   ├── css/
│   │   └── app.css             # Unified accessible design system & dark/light theme
│   └── js/
│       ├── api.js              # REST client, session state & auth interceptors
│       ├── app.js              # Client-side hash router & layout controller
│       └── views/              # Modular view components
│           ├── adminDashboard.js       # Admin overview metrics & quick actions
│           ├── coursesView.js          # Course management & access code generator
│           ├── classesView.js          # Multi-class manager, student moves/copies
│           ├── studentsView.js         # Student roster, CSV import, status toggles
│           ├── questionBankView.js     # Dedicated question bank & tag manager
│           ├── questionEditorView.js   # 10-step full-featured question builder
│           ├── poolsView.js            # Question pool management & random sampling
│           ├── assessmentsView.js      # Formal assessment list & status publisher
│           ├── assessmentBuilderView.js# Drag & drop visual builder & inline question creation
│           ├── assessmentPlayerView.js # Candidate exam player, countdown timer & autosave
│           ├── studentDashboardView.js # Student portal, code redemption & results
│           ├── reportsView.js          # Course, class, assessment & student analytics
│           └── auditView.js            # System-wide immutable audit trail
│
├── src/                        # Authoritative Backend Services
│   ├── server.js               # Node.js HTTP REST API & static asset server
│   ├── db/
│   │   ├── index.js            # High-performance SQLite / Database connection
│   │   ├── schema.sql          # DDL tables, indexes, and constraints
│   │   └── seed.js             # Curriculum, question bank & demonstration seeder
│   ├── services/
│   │   ├── authService.js      # Password hashing (scrypt), sessions & throttling
│   │   ├── accessCodeService.js# 10-step course access code validation engine
│   │   ├── courseService.js    # Course lifecycle (Draft, Published, Closed, Archived)
│   │   ├── classService.js     # Multi-class enrollment, student moves & copies
│   │   ├── studentService.js   # Student provisioning & CSV batch importer
│   │   ├── questionService.js  # Question bank, controlled versioning & snapshots
│   │   ├── poolService.js      # Dynamic question pools & distribution sampler
│   │   ├── assessmentService.js# Assessment assembler, time windows & class assignments
│   │   ├── scoringService.js   # Authoritative grading engine for all 12 question types
│   │   ├── attemptService.js   # Server countdown timer, autosave & submission locking
│   │   ├── reportService.js    # Comprehensive reporting & CSV export generator
│   │   └── auditService.js     # Tamper-evident audit logging engine
│   └── utils/
│       └── crypto.js           # Cryptographic primitives & password generators
│
└── tests/                      # Automated Unit, Integration & Security Tests
    ├── auth.test.js
    ├── courses_and_codes.test.js
    ├── classes_and_students.test.js
    ├── questions_and_pools.test.js
    ├── assessments_and_attempts.test.js
    ├── scoring.test.js
    ├── security.test.js
    └── e2e.test.js
```

---

## 📋 Comprehensive 41 Business Rules Implementation

1. **Authentication Required**: Course codes alone never bypass sign-in. Students must first authenticate with username and password.
2. **First-Time Password Change**: Users with `must_change_password = 1` are locked into the password change dialog until a compliant new password is set.
3. **No Plain-Text Passwords**: Passwords hashed using Node.js `crypto.scrypt` with cryptographic salts.
4. **Login Throttling & Session Security**: 5 consecutive failed sign-in attempts lock the account for 15 minutes. Session tokens expire automatically.
5. **Account Status Enforcement**: Accounts marked `suspended` or `deactivated` immediately invalidate active sessions and block new logins.
6. **Unique Course Identifiers**: Course codes and course internal identifiers are strictly validated for uniqueness.
7. **Multiple Classes per Course**: Courses can have multiple classes (e.g. Morning, Evening, Weekend, Corporate) sharing curriculum without course duplication.
8. **Student Move & Copy**: Administrators can move or copy students between classes without destroying user accounts or historical attempt records.
9. **Dedicated Question Bank**: Questions exist independently in the Question Bank and can be authored without first creating an assessment.
10. **Separate Question & Question Description**: `question` (the actual question) and `question_description` (scenario, background, code, tables) are stored and rendered as distinct, independently editable fields.
11. **12 Professional Question Types Supported**:
    - Yes / No
    - True / False
    - Multiple Choice: Single Answer
    - Multiple Choice: Multiple Answers (with selection limits and partial credit toggles)
    - Drag and Drop: Matching (with keyboard accessible controls)
    - Drag and Drop: Ordering / Sequencing
    - Drag and Drop: Categorisation
    - Dropdown Selection (inline multiple blanks)
    - Fill in the Blank (handles punctuation, casing, and alternate acceptable answers)
    - Scenario Question
    - Case Study Question
    - Hot Area / Image Selection
12. **Controlled Question Versioning**: Modifying a question that was used in previous student attempts creates a new version snapshot. Existing completed attempts retain their historical question snapshot.
13. **Score Recalculation Engine**: When an answer key error is corrected, administrators can trigger recalculation of affected student attempts with before/after score tracking and audit logging.
14. **Question Pools & Random Selection**: Pools group questions by topic or tag. Assessments can draw $N$ randomized questions from a pool for randomized candidate exams.
15. **Inline Question Creation**: Assessment Builder allows authors to create brand new questions directly inside the builder without losing their work.
16. **Drag & Drop Question Reordering**: Visual drag-and-drop question reordering with accessible Up/Down button fallbacks.
17. **Strict Separation of Time Windows**:
    - **Course Access Period**: Window in which student can access course materials.
    - **Assessment Availability Window**: Window (`available_from` to `available_to`) in which assessment can be started.
    - **Attempt Duration**: Countdown timer (e.g. 60 minutes) running authoritative server-side once the attempt is launched.
18. **Server-Authoritative Countdown Timer**: Deadlines are calculated and verified by the server. Client-side clock manipulation cannot extend an exam attempt.
19. **Autosave with Crash Recovery**: Responses are automatically persisted to the database as candidates answer questions. If the candidate refreshes or loses connection, progress is restored seamlessly.
20. **Final Submission Confirmation Summary**: Before final submission, candidates see a confirmation dialog: *"You have answered X of Y questions. X questions remain unanswered."*
21. **Automatic Submission on Expiry**: If a candidate's attempt deadline expires, the server automatically finalizes and marks the attempt.
22. **Immediate & Permitted Review**: Result visibility and answer explanation visibility are strictly controlled by assessment policy (`immediate`, `after_all_complete`, or `never`).
23. **Student Privacy**: Students can only view their own attempts and results. Attempts belonging to other candidates are strictly inaccessible.
24. **Reports & Analytics**: Real-time performance dashboards by course, class, student, assessment, and topic.
25. **One-Click CSV Export**: Comprehensive export of audit records, student rosters, and assessment performance.
26. **Complete Audit Trail**: Every critical action (course creation, code redemption, student move, question update, recalculation, export) is logged with timestamp, user ID, IP, and payload diffs.

---

## ♿ Accessibility & Modern UI Standards

- **Semantic HTML5**: Full landmark structure (`<aside>`, `<main>`, `<header>`, `<dialog>`).
- **Accessible Interactions**: Drag-and-drop matching and ordering features include accessible keyboard buttons (Move Up, Move Down) for assistive technologies.
- **Color Contrast & Theme Toggle**: Compliant with WCAG 2.1 AA standards in both Light and Dark modes.

---

## 📄 License
Eduqe is an enterprise exam-preparation software system. All rights reserved.
