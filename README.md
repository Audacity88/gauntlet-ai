# ChatGenius

A real-time chat application with AI-powered features, built as a learning project during [Gauntlet AI](https://www.gauntlet.team/) bootcamp (January 2025).

**Stack:** React + TypeScript + Vite frontend, FastAPI + Python backend, Supabase (PostgreSQL + Auth + Realtime + Storage), OpenAI integration, pgvector for RAG embeddings.

## 🎯 Features

- **Real-time messaging** in public/private channels
- **Direct messaging** between users
- **File attachments** with cloud storage
- **User presence** and status indicators
- **Message search** within channels
- **AI avatar chat** with conversation history (RAG-powered)
- **Thread replies** for organized discussions

## 🚧 Project Status

**Portfolio project** demonstrating full-stack development with modern real-time features. Built in ~2 weeks as a learning exercise.

### ✅ Working

- Channel messaging with real-time updates (with database configuration)
- User authentication (email/password, OAuth providers)
- Profile management
- Message search
- Frontend unit tests (55 tests passing)
- Production build pipeline

### ⚠️ Known Limitations

- **Demo deployment:** The public demo requires Supabase credentials. Running locally requires your own Supabase project (see setup below).
- **Database migrations:** Historical migration files need consolidation (108 files with some duplicates/conflicts). Fresh setup requires manual schema reconciliation.
- **Type safety:** ~355 TypeScript strict-mode errors remain from rapid development. Tests run via ts-jest with isolated type checking.
- **Backend tests:** Require refactoring after database layer changes.
- **Security:** RLS policies need review before production use.
- **DMs/AI chat:** Require additional database function setup beyond base migrations.
- **Thread replies:** UI logic needs refinement.

See [RESULTS evidence](uploads/RESULTS_4127.md) and [Portfolio Report](uploads/PORTFOLIO_REPORT_2135.md) for detailed technical assessment.

## 🚀 Local Setup

### Prerequisites

- Node.js 18+ and npm
- Python 3.10+
- Supabase account OR [Supabase CLI](https://supabase.com/docs/guides/cli) for local development
- OpenAI API key (for AI features)

### Frontend

1. Install dependencies:
   ```bash
   cd frontend
   npm install
   ```

2. Create `frontend/.env.local` with your Supabase project values:
   ```env
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key
   VITE_API_URL=http://localhost:8000
   ```

3. Start development server:
   ```bash
   npm run dev
   ```
   Frontend will run on `http://localhost:5173`

4. Run tests:
   ```bash
   npm test
   ```

5. Build for production:
   ```bash
   npm run build
   ```

### Backend

1. Set up Python environment:
   ```bash
   cd backend
   python3 -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
   Note: If installation fails, you may need to add `numpy`, `sqlalchemy`, and `greenlet` manually.

3. Create `backend/.env` with your configuration:
   ```env
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_KEY=your-anon-key
   SUPABASE_SERVICE_KEY=your-service-role-key
   SUPABASE_JWT_SECRET=your-jwt-secret
   OPENAI_API_KEY=your-openai-api-key
   SECRET_KEY=your-app-secret
   ENVIRONMENT=development
   ```

4. Start server:
   ```bash
   uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
   ```
   API will run on `http://127.0.0.1:8000` (docs at `/docs`)

### Database Setup

The `supabase/migrations/` directory contains historical migration files that need manual reconciliation. For a working setup:

1. **Using Supabase Cloud:**
   - Create a new project at [supabase.com](https://supabase.com)
   - Get your project URL and keys from Settings → API
   - Manually apply schema from migrations or use SQL editor

2. **Using Supabase CLI (recommended for local dev):**
   ```bash
   supabase init
   supabase start
   ```
   Get local credentials with `supabase status`

**Note:** Some migrations may fail due to conflicts. You'll need to:
- Enable Auth (email/password and/or OAuth providers)
- Set up required tables: `profiles`, `channels`, `channel_members`, `messages`, `direct_messages`, etc.
- Configure RLS policies for your use case
- Enable Realtime for `messages`, `channels`, and `profiles` tables
- Create storage bucket for attachments
- Set up RPC functions (see `supabase/migrations/` for reference)

## 📁 Project Structure

```
gauntlet-ai/
├── frontend/           # React + TypeScript + Vite app
│   ├── src/
│   │   ├── components/  # UI components
│   │   ├── pages/       # Route pages
│   │   ├── stores/      # Zustand state management
│   │   ├── hooks/       # Custom React hooks
│   │   ├── types/       # TypeScript types
│   │   └── lib/         # Utilities (Supabase client, etc.)
│   └── __tests__/      # Jest unit tests
├── backend/            # FastAPI Python server
│   ├── app/
│   │   ├── api/        # REST endpoints
│   │   ├── core/       # Auth, config, database
│   │   └── rag/        # Vector embeddings & RAG
│   └── alembic/        # (Not actively used)
├── supabase/
│   └── migrations/     # Historical SQL files
└── docs/              # Development notes
```

**Note:** The root `src/` directory contains an unused Vite starter template. The actual application is in `frontend/`.

## 🧪 Testing & CI

- **Frontend tests:** `npm test` in `frontend/` directory (55 passing tests via Jest)
- **CI:** GitHub Actions runs frontend tests + production build on PRs/pushes to main
- **Typecheck:** Available via `npm run typecheck` (currently has errors from rapid development)

## 🌐 Deployment Notes

- **Vercel:** Previous deployment at `chatgenius-theta.vercel.app` is no longer active
- **GitHub Pages:** Static site at [audacity88.github.io/chatgenius](https://audacity88.github.io/chatgenius) serves an older build pointing to a deleted Supabase project

To deploy:
1. Set up a Supabase project with proper schema
2. Configure environment variables in your hosting platform
3. Build frontend with production env vars: `VITE_SUPABASE_URL=... npm run build`
4. Deploy `frontend/dist/` to static host
5. Deploy backend to a Python-compatible platform (Railway, Fly.io, etc.)

## 📝 Development Notes

This project was built during a 2-week bootcamp sprint to learn:
- Real-time data synchronization with Supabase
- FastAPI backend development
- RAG implementation with pgvector
- Modern React patterns (hooks, Zustand, React Router)
- TypeScript in a full-stack application

**Not production-ready.** Suitable for portfolio demonstration of technical range and learning ability.

## 📄 License

MIT License - See LICENSE file for details.

## 👤 Author

Dan Gilles - [Portfolio](https://dangilles.dev)
