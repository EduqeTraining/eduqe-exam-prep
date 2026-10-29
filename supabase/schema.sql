-- =========================================================
-- Eduqe Platform - PostgreSQL Schema for Supabase
-- Run this script in your Supabase SQL Editor
-- =========================================================

-- Compatibility function for any SQL expressions referencing datetime('now')
CREATE OR REPLACE FUNCTION datetime(t text DEFAULT 'now') 
RETURNS timestamptz AS $$
BEGIN
    RETURN CURRENT_TIMESTAMP;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 1. Users Table
CREATE TABLE IF NOT EXISTS "users" (
    "id" TEXT PRIMARY KEY,
    "username" TEXT UNIQUE NOT NULL,
    "email" TEXT UNIQUE NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'student',
    "first_name" TEXT NOT NULL,
    "surname" TEXT NOT NULL,
    "student_number" TEXT,
    "account_status" TEXT NOT NULL DEFAULT 'active', -- 'active', 'suspended', 'deactivated'
    "must_change_password" INTEGER NOT NULL DEFAULT 0,
    "created_at" TEXT DEFAULT CURRENT_TIMESTAMP::text,
    "updated_at" TEXT DEFAULT CURRENT_TIMESTAMP::text
);

-- 2. Sessions Table
CREATE TABLE IF NOT EXISTS "sessions" (
    "id" TEXT PRIMARY KEY,
    "token" TEXT UNIQUE NOT NULL,
    "user_id" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
    "expires_at" TEXT NOT NULL,
    "created_at" TEXT DEFAULT CURRENT_TIMESTAMP::text
);

CREATE TABLE IF NOT EXISTS "revoked_tokens" (
    "token" TEXT PRIMARY KEY,
    "revoked_at" TEXT DEFAULT CURRENT_TIMESTAMP::text
);

-- 3. Login Attempts (Rate limiting & Security)
CREATE TABLE IF NOT EXISTS "login_attempts" (
    "id" TEXT PRIMARY KEY,
    "ip_address" TEXT NOT NULL,
    "username" TEXT,
    "attempted_at" TEXT DEFAULT CURRENT_TIMESTAMP::text,
    "success" INTEGER NOT NULL DEFAULT 0
);

-- 4. Courses Table
CREATE TABLE IF NOT EXISTS "courses" (
    "id" TEXT PRIMARY KEY,
    "name" TEXT NOT NULL,
    "code" TEXT UNIQUE NOT NULL,
    "description" TEXT,
    "subject" TEXT,
    "learning_track" TEXT,
    "image_url" TEXT,
    "start_date" TEXT,
    "end_date" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft', -- 'draft', 'published', 'closed', 'archived'
    "created_by" TEXT REFERENCES "users"("id"),
    "created_at" TEXT DEFAULT CURRENT_TIMESTAMP::text,
    "updated_at" TEXT DEFAULT CURRENT_TIMESTAMP::text
);

-- 5. Classes Table
CREATE TABLE IF NOT EXISTS "classes" (
    "id" TEXT PRIMARY KEY,
    "course_id" TEXT NOT NULL REFERENCES "courses"("id") ON DELETE CASCADE,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "facilitator_name" TEXT,
    "instructor_id" TEXT REFERENCES "users"("id"),
    "start_date" TEXT,
    "end_date" TEXT,
    "access_duration_days" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'active', -- 'active', 'archived'
    "created_at" TEXT DEFAULT CURRENT_TIMESTAMP::text,
    "updated_at" TEXT DEFAULT CURRENT_TIMESTAMP::text
);

-- 6. Course & Class Access Codes
CREATE TABLE IF NOT EXISTS "course_access_codes" (
    "id" TEXT PRIMARY KEY,
    "course_id" TEXT NOT NULL REFERENCES "courses"("id") ON DELETE CASCADE,
    "class_id" TEXT REFERENCES "classes"("id") ON DELETE CASCADE,
    "code" TEXT UNIQUE NOT NULL,
    "is_active" INTEGER NOT NULL DEFAULT 1,
    "expires_at" TEXT,
    "max_uses" INTEGER,
    "used_count" INTEGER DEFAULT 0,
    "created_by" TEXT REFERENCES "users"("id"),
    "created_at" TEXT DEFAULT CURRENT_TIMESTAMP::text
);

-- 7. Class Enrollments
CREATE TABLE IF NOT EXISTS "class_enrollments" (
    "id" TEXT PRIMARY KEY,
    "class_id" TEXT NOT NULL REFERENCES "classes"("id") ON DELETE CASCADE,
    "user_id" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
    "enrolled_at" TEXT DEFAULT CURRENT_TIMESTAMP::text,
    "access_starts_at" TEXT,
    "access_expires_at" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active', -- 'active', 'suspended', 'revoked', 'expired'
    "granted_by_code_id" TEXT REFERENCES "course_access_codes"("id"),
    UNIQUE("class_id", "user_id")
);

-- 8. Question Bank
CREATE TABLE IF NOT EXISTS "questions" (
    "id" TEXT PRIMARY KEY,
    "course_id" TEXT REFERENCES "courses"("id") ON DELETE SET NULL,
    "topic" TEXT,
    "learning_objective" TEXT,
    "section_module" TEXT,
    "difficulty" TEXT NOT NULL DEFAULT 'medium', -- 'easy', 'medium', 'hard'
    "tags" TEXT, -- JSON array string
    "question_type" TEXT NOT NULL, 
    "question_text" TEXT NOT NULL,
    "question_description" TEXT,
    "answer_options" TEXT NOT NULL, -- JSON array / object
    "correct_answer" TEXT NOT NULL, -- JSON answer key
    "answer_explanation" TEXT,
    "explanation_visibility" TEXT DEFAULT 'after_submission',
    "points" REAL DEFAULT 1,
    "partial_credit" INTEGER DEFAULT 0,
    "negative_marking" INTEGER DEFAULT 0,
    "randomize_options" INTEGER DEFAULT 1,
    "requires_manual_review" INTEGER DEFAULT 0,
    "status" TEXT DEFAULT 'draft', -- 'draft', 'ready_for_review', 'approved', 'published', 'archived'
    "version" INTEGER DEFAULT 1,
    "parent_question_id" TEXT REFERENCES "questions"("id"),
    "created_by" TEXT REFERENCES "users"("id"),
    "created_at" TEXT DEFAULT CURRENT_TIMESTAMP::text,
    "updated_at" TEXT DEFAULT CURRENT_TIMESTAMP::text
);

-- 9. Question Versions Audit
CREATE TABLE IF NOT EXISTS "question_versions" (
    "id" TEXT PRIMARY KEY,
    "question_id" TEXT NOT NULL REFERENCES "questions"("id") ON DELETE CASCADE,
    "version" INTEGER NOT NULL,
    "question_data" TEXT NOT NULL,
    "change_reason" TEXT,
    "changed_by" TEXT REFERENCES "users"("id"),
    "created_at" TEXT DEFAULT CURRENT_TIMESTAMP::text
);

-- 10. Question Pools
CREATE TABLE IF NOT EXISTS "question_pools" (
    "id" TEXT PRIMARY KEY,
    "course_id" TEXT REFERENCES "courses"("id") ON DELETE CASCADE,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "random_count" INTEGER DEFAULT 5,
    "created_at" TEXT DEFAULT CURRENT_TIMESTAMP::text
);

-- 11. Question Pool Items
CREATE TABLE IF NOT EXISTS "question_pool_items" (
    "id" TEXT PRIMARY KEY,
    "pool_id" TEXT NOT NULL REFERENCES "question_pools"("id") ON DELETE CASCADE,
    "question_id" TEXT NOT NULL REFERENCES "questions"("id") ON DELETE CASCADE,
    UNIQUE("pool_id", "question_id")
);

-- 12. Assessments
CREATE TABLE IF NOT EXISTS "assessments" (
    "id" TEXT PRIMARY KEY,
    "course_id" TEXT NOT NULL REFERENCES "courses"("id") ON DELETE CASCADE,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "instructions" TEXT,
    "pass_mark_percentage" REAL DEFAULT 70,
    "duration_minutes" INTEGER DEFAULT 60,
    "max_attempts" INTEGER DEFAULT 1,
    "available_from" TEXT,
    "available_to" TEXT,
    "allow_back_navigation" INTEGER DEFAULT 1,
    "allow_flagging" INTEGER DEFAULT 1,
    "allow_review_screen" INTEGER DEFAULT 1,
    "randomize_questions" INTEGER DEFAULT 0,
    "randomize_answers" INTEGER DEFAULT 0,
    "result_visibility" TEXT DEFAULT 'immediate',
    "explanation_visibility" TEXT DEFAULT 'after_submission',
    "sections" TEXT DEFAULT '["Section 1","Section 2","Section 3"]',
    "status" TEXT DEFAULT 'draft', -- 'draft', 'published', 'unpublished', 'archived'
    "created_by" TEXT REFERENCES "users"("id"),
    "created_at" TEXT DEFAULT CURRENT_TIMESTAMP::text,
    "updated_at" TEXT DEFAULT CURRENT_TIMESTAMP::text
);

-- 13. Assessment Class Allocations
CREATE TABLE IF NOT EXISTS "assessment_classes" (
    "id" TEXT PRIMARY KEY,
    "assessment_id" TEXT NOT NULL REFERENCES "assessments"("id") ON DELETE CASCADE,
    "class_id" TEXT NOT NULL REFERENCES "classes"("id") ON DELETE CASCADE,
    UNIQUE("assessment_id", "class_id")
);

-- 14. Assessment Questions & Sections
CREATE TABLE IF NOT EXISTS "assessment_questions" (
    "id" TEXT PRIMARY KEY,
    "assessment_id" TEXT NOT NULL REFERENCES "assessments"("id") ON DELETE CASCADE,
    "question_id" TEXT REFERENCES "questions"("id") ON DELETE CASCADE,
    "pool_id" TEXT REFERENCES "question_pools"("id") ON DELETE CASCADE,
    "section_name" TEXT DEFAULT 'Section 1',
    "order_index" INTEGER NOT NULL DEFAULT 0,
    "points_override" REAL
);

-- 15. Student Attempts
CREATE TABLE IF NOT EXISTS "student_attempts" (
    "id" TEXT PRIMARY KEY,
    "assessment_id" TEXT NOT NULL REFERENCES "assessments"("id") ON DELETE CASCADE,
    "user_id" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
    "class_id" TEXT NOT NULL REFERENCES "classes"("id") ON DELETE CASCADE,
    "attempt_number" INTEGER NOT NULL,
    "started_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP::text,
    "deadline_at" TEXT NOT NULL,
    "submitted_at" TEXT,
    "status" TEXT NOT NULL DEFAULT 'in_progress', -- 'in_progress', 'submitted', 'marked', 'awaiting_review', 'expired'
    "score" REAL DEFAULT 0,
    "max_score" REAL DEFAULT 0,
    "percentage" REAL DEFAULT 0,
    "is_passed" INTEGER DEFAULT 0,
    "score_recalculated" INTEGER DEFAULT 0,
    "recalculation_reason" TEXT,
    "recalculated_at" TEXT,
    "recalculated_by" TEXT REFERENCES "users"("id"),
    "original_score" REAL
);

-- 16. Attempt Answers
CREATE TABLE IF NOT EXISTS "attempt_answers" (
    "id" TEXT PRIMARY KEY,
    "attempt_id" TEXT NOT NULL REFERENCES "student_attempts"("id") ON DELETE CASCADE,
    "question_id" TEXT NOT NULL REFERENCES "questions"("id") ON DELETE CASCADE,
    "question_version" INTEGER DEFAULT 1,
    "section_name" TEXT DEFAULT 'Section 1',
    "order_index" INTEGER DEFAULT 0,
    "saved_answer" TEXT,
    "is_flagged" INTEGER DEFAULT 0,
    "is_correct" INTEGER,
    "awarded_points" REAL DEFAULT 0,
    "max_points" REAL DEFAULT 1,
    "marked_status" TEXT DEFAULT 'pending', -- 'pending', 'auto_marked', 'manual_marked'
    "manual_notes" TEXT,
    "saved_at" TEXT DEFAULT CURRENT_TIMESTAMP::text,
    UNIQUE("attempt_id", "question_id")
);

-- 17. Audit Logs
CREATE TABLE IF NOT EXISTS "audit_logs" (
    "id" TEXT PRIMARY KEY,
    "user_id" TEXT REFERENCES "users"("id") ON DELETE SET NULL,
    "username" TEXT,
    "action" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT,
    "details" TEXT,
    "ip_address" TEXT,
    "created_at" TEXT DEFAULT CURRENT_TIMESTAMP::text
);

-- 18. Settings
CREATE TABLE IF NOT EXISTS "eduque_settings" (
    "id" TEXT PRIMARY KEY,
    "key" TEXT UNIQUE NOT NULL,
    "value" TEXT NOT NULL,
    "updated_at" TEXT DEFAULT CURRENT_TIMESTAMP::text
);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS "idx_users_username" ON "users"("username");
CREATE INDEX IF NOT EXISTS "idx_users_role" ON "users"("role");
CREATE INDEX IF NOT EXISTS "idx_sessions_token" ON "sessions"("token");
CREATE INDEX IF NOT EXISTS "idx_courses_code" ON "courses"("code");
CREATE INDEX IF NOT EXISTS "idx_courses_status" ON "courses"("status");
CREATE INDEX IF NOT EXISTS "idx_codes_code" ON "course_access_codes"("code");
CREATE INDEX IF NOT EXISTS "idx_classes_course" ON "classes"("course_id");
CREATE INDEX IF NOT EXISTS "idx_enroll_user" ON "class_enrollments"("user_id");
CREATE INDEX IF NOT EXISTS "idx_enroll_class" ON "class_enrollments"("class_id");
CREATE INDEX IF NOT EXISTS "idx_questions_course" ON "questions"("course_id");
CREATE INDEX IF NOT EXISTS "idx_questions_type" ON "questions"("question_type");
CREATE INDEX IF NOT EXISTS "idx_assessments_course" ON "assessments"("course_id");
CREATE INDEX IF NOT EXISTS "idx_attempts_user" ON "student_attempts"("user_id");
CREATE INDEX IF NOT EXISTS "idx_attempts_assessment" ON "student_attempts"("assessment_id");
CREATE INDEX IF NOT EXISTS "idx_attempt_answers_attempt" ON "attempt_answers"("attempt_id");
CREATE INDEX IF NOT EXISTS "idx_audit_created" ON "audit_logs"("created_at");

-- Disable Row Level Security so backend PostgREST operations can read/write freely
ALTER TABLE "users" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "courses" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "classes" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "course_access_codes" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "class_enrollments" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "questions" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "question_versions" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "question_pools" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "question_pool_items" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "assessments" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "assessment_classes" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "assessment_questions" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "student_attempts" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "attempt_answers" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "audit_logs" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "sessions" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "revoked_tokens" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "login_attempts" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "eduque_settings" DISABLE ROW LEVEL SECURITY;
