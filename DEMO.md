# ChatGenius Demo Guide

This guide helps you understand and evaluate ChatGenius without setting up your own Supabase instance.

## 🌐 Public Deployment Status

**Current status:** The hosted demo requires authentication setup. 

- **GitHub Pages** ([audacity88.github.io/chatgenius](https://audacity88.github.io/chatgenius)): Serves a static build but cannot authenticate without a live Supabase backend.
- **Previous Vercel deployment** (chatgenius-theta.vercel.app): No longer active.

**Why authentication is required:** ChatGenius is a full-stack application that requires:
- Supabase for authentication, real-time database, and file storage
- Backend API for AI features (optional for basic chat)

## 📹 Feature Walkthrough

### What Works (with proper setup)

1. **Authentication**
   - Email/password sign-up and sign-in
   - OAuth providers (GitHub, Google) with configuration
   - Password strength validation
   - Profile creation after sign-up

2. **Channel Messaging**
   - Create public/private channels
   - Send and receive messages in real-time
   - Message persistence
   - Channel navigation in sidebar

3. **Search**
   - Search messages within current channel
   - Real-time filtering as you type

4. **User Profiles**
   - Update display name and username
   - Set status (Online, Away, Busy, Offline)
   - Avatar support (via Supabase storage)

5. **File Attachments**
   - Upload images and files
   - Inline image previews
   - Cloud storage via Supabase

### What Requires Additional Setup

These features are implemented but require specific database functions/tables beyond base migrations:

- **Direct Messages (DMs):** Requires `find_or_create_dm_channel` RPC function
- **AI Avatar Chat:** Requires backend API, OpenAI integration, and DM infrastructure
- **Thread Replies:** UI implemented but needs schema refinement
- **Message Editing:** UI present but not fully wired
- **Emoji Reactions:** Table exists but UI not implemented

## 🎬 Quick Setup for Local Demo

If you want to see the app running locally:

### Minimal Setup (10 minutes)

1. **Clone and install:**
   ```bash
   git clone https://github.com/Audacity88/gauntlet-ai.git
   cd gauntlet-ai/frontend
   npm install
   ```

2. **Use Supabase CLI for local database:**
   ```bash
   # Install Supabase CLI: https://supabase.com/docs/guides/cli
   supabase init
   supabase start
   ```
   This starts a local Supabase instance with Docker.

3. **Get local credentials:**
   ```bash
   supabase status
   ```
   Note the `API URL` and `anon key`.

4. **Configure frontend:**
   Create `frontend/.env.local`:
   ```env
   VITE_SUPABASE_URL=http://127.0.0.1:54321  # From supabase status
   VITE_SUPABASE_ANON_KEY=<anon-key>         # From supabase status
   VITE_API_URL=http://localhost:8000
   ```

5. **Apply minimal schema:**
   The migrations need reconciliation, but you can use the SQL editor at `http://localhost:54323` to create:
   - Enable Auth (already enabled in local setup)
   - Create `profiles` table (see `supabase/migrations/` for reference)
   - Create `channels`, `channel_members`, `messages` tables
   - Set up basic RLS policies
   - Enable Realtime for these tables

6. **Start frontend:**
   ```bash
   npm run dev
   ```
   Open `http://localhost:5173`

7. **Create test account:**
   - Click "Sign up"
   - Use any email (local setup auto-confirms)
   - Create a profile

You should now see the working chat interface!

### Full Setup (includes AI features)

Follow the main [README.md](README.md) setup instructions including:
- Backend API setup (Python/FastAPI)
- OpenAI API key for AI features
- Complete database migration reconciliation

## 📊 Technical Demonstration

### Architecture Highlights

- **Frontend:** React 18 + TypeScript + Vite
  - Zustand for state management (stores in `frontend/src/stores/`)
  - React Router for navigation
  - TailwindCSS for styling
  - Real-time hooks for Supabase subscriptions

- **Backend:** FastAPI + Python
  - Pydantic models and validation
  - JWT auth integration
  - OpenAI API integration for AI features
  - pgvector RAG implementation

- **Database:** PostgreSQL via Supabase
  - Row Level Security (RLS) policies
  - Real-time subscriptions
  - Storage for attachments
  - Vector embeddings for RAG

### Code Quality Indicators

- **Tests:** 55 passing frontend unit tests (Jest + ts-jest)
- **CI/CD:** GitHub Actions for automated testing and builds
- **Type Safety:** TypeScript throughout (strict mode enabled, though ~355 errors remain from rapid prototyping)
- **Code Organization:** Clear separation of concerns (components, hooks, stores, types, utilities)

### Portfolio Value

This project demonstrates:
✅ Full-stack development (React + Python)
✅ Real-time features (WebSocket subscriptions)
✅ Modern auth patterns (Supabase Auth)
✅ AI integration (OpenAI + RAG)
✅ Database design (PostgreSQL + RLS)
✅ Testing practices (Jest unit tests)
✅ Cloud storage integration
✅ Build pipelines and CI/CD

## 🔍 Evaluating the Code

### Recommended areas to review:

1. **Real-time messaging logic:** `frontend/src/hooks/useRealtimeMessages.ts`
2. **State management:** `frontend/src/stores/` (channelStore, messageStore, userStore)
3. **API integration:** `frontend/src/hooks/useChannels.ts`, `useMessages.ts`
4. **Backend structure:** `backend/app/api/routes/` for REST endpoints
5. **RAG implementation:** `backend/app/rag/` for vector embeddings
6. **Type definitions:** `frontend/src/types/models.ts` for data models
7. **Test coverage:** `frontend/src/**/__tests__/` for unit tests

## 🎯 Honest Assessment

**What this project is:**
- A learning exercise from a 2-week bootcamp
- Demonstration of technical range and learning ability
- Full-stack implementation with modern tools
- Working proof-of-concept with core features functional

**What this project is not:**
- Production-ready (security review needed)
- Fully polished (TypeScript strict mode errors remain)
- Complete (some features partially implemented)
- Enterprise-scale (built for learning, not scale)

**Recommended presentation approach:**
> "ChatGenius is a full-stack real-time chat application I built during a 2-week intensive bootcamp to learn modern web technologies. It demonstrates working knowledge of React, TypeScript, Python/FastAPI, PostgreSQL, real-time subscriptions, AI integration, and cloud services. While not production-ready, it shows my ability to rapidly learn new technologies and build functional full-stack applications."

## 📞 Questions?

For technical questions or to discuss the implementation, reach out via:
- GitHub: [@Audacity88](https://github.com/Audacity88)
- Portfolio: [dangilles.dev](https://dangilles.dev)

---

**Note:** This is a portfolio/learning project. Some features require additional setup beyond what's shown here. See the main [README.md](README.md) for complete setup instructions and known limitations.
