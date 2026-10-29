# Linking Eduqe to Supabase

This guide explains how to connect your **Eduqe Platform** to a persistent **Supabase PostgreSQL** database for cloud persistence when hosted on Vercel.

---

## 📋 Prerequisites
1. A Supabase account at [supabase.com](https://supabase.com).
2. A free or pro Supabase organization.

---

## 🚀 Step 1: Create a Supabase Project

1. Log into your Supabase dashboard at [database.new](https://database.new).
2. Click **"New Project"**.
3. Choose your project name (e.g. `eduqe-exam-system`).
4. Set a strong database password (and save it securely).
5. Choose the AWS region closest to your Vercel deployment region.
6. Click **"Create new project"** (takes ~1-2 minutes to provision).

---

## 🗄️ Step 2: Initialize Tables & Demonstrations in Supabase

1. In your Supabase project dashboard, open the **SQL Editor** (icon with `>_` on the left sidebar).
2. Click **"New query"**.
3. Copy the entire contents of [`supabase/schema.sql`](./schema.sql) and paste it into the query editor.
4. Click **"Run"** (or press `Ctrl+Enter`).
   - *This creates all 18 tables, compatibility functions, foreign keys, and performance indexes.*
5. Open another new query tab.
6. Copy the entire contents of [`supabase/seed.sql`](./seed.sql) and paste it into the editor.
7. Click **"Run"**.
   - *This seeds all 78 curriculum questions, 2 courses (AZ-900 & AZ-104), classes, access codes, and demo accounts.*

---

## 🔗 Step 3: Link Supabase to Vercel

### Option A: The 1-Click Vercel Integration (Recommended)

1. Open your Vercel Project Dashboard on [vercel.com](https://vercel.com).
2. Go to **Settings** → **Integrations**.
3. Search for **"Supabase"** and click **Add Integration**.
4. Select your Vercel account and project (`eduqe`).
5. Choose your Supabase project created in Step 1.
6. Click **Connect**.
   - *Vercel will automatically configure `POSTGRES_URL`, `SUPABASE_URL`, and keys into your project's Environment Variables!*

### Option B: Manual Environment Variables in Vercel

If you prefer adding the keys manually:
1. In your Supabase Dashboard, go to **Project Settings** → **API**.
2. Copy:
   - **Project URL** (e.g. `https://xyz.supabase.co`)
   - **Project API Keys**:
     - `anon` `public`
     - `service_role` `secret` *(Click 'Reveal')*
3. In your Vercel Dashboard, go to your project → **Settings** → **Environment Variables**.
4. Add the following variables:
   - `SUPABASE_URL` = `https://your-project.supabase.co`
   - `SUPABASE_ANON_KEY` = `<your-anon-key>`
   - `SUPABASE_SERVICE_ROLE_KEY` = `<your-service-role-key>`
5. Click **Save** and trigger a redeployment.

---

## 🔄 Step 4: How Eduqe Uses Supabase

- **Zero-Latency In-Memory Execution**: The exam player continues to deliver instant question transitions, countdown timers, and autosave responses.
- **Continuous Cloud Sync**: Whenever students register or submit exams, Eduqe automatically records the attempts, scores, and answer keys in Supabase PostgreSQL tables.
- **Bi-Directional Admin Sync**: Administrators can trigger two-way synchronizations or check live Supabase connectivity via:
  - `GET /api/supabase/status` (Check live connectivity)
  - `POST /api/supabase/sync` (Trigger push or pull sync)
