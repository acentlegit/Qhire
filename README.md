# QHire - AI-Powered Recruitment Management Platform

> Enterprise-grade ATS with AI interview capabilities, intelligent candidate matching, and comprehensive hiring workflows.

[![Next.js](https://img.shields.io/badge/Next.js-14-black)](https://nextjs.org/)
[![Prisma](https://img.shields.io/badge/Prisma-ORM-blue)](https://www.prisma.io/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Database-blue)](https://www.postgresql.org/)

## 🚀 Features

### Core Functionality
- ✅ **Role-Based Access Control** - Admin, Recruiter, Hiring Manager roles with granular permissions
- ✅ **Job Management** - Create, edit, and manage job postings with rich descriptions
- ✅ **Candidate Management** - Comprehensive candidate profiles with resume parsing
- ✅ **Application Pipeline** - Drag-and-drop Kanban board for application stages
- ✅ **Calendar Integration** - Schedule and manage interviews with Google/Microsoft Calendar
- ✅ **AI-Powered Interview** - Automated AI interviews with voice detection and analysis
- ✅ **Bulk Resume Processing** - Upload and parse multiple resumes simultaneously
- ✅ **AI Assistant Chat** - Context-aware chat assistant for recruitment queries
- ✅ **Dark Mode** - System-aware theme switching

### AI Features
- 🤖 **AI Interview System** - State machine-driven interviews with voice recognition
- 📄 **Resume Parsing** - Intelligent extraction of candidate data from PDFs/DOCX
- 💬 **AI Chat Assistant** - Context-aware recruitment assistant
- 🎯 **Candidate Matching** - Vector embeddings for job-candidate matching
- 📊 **Interview Analysis** - AI-powered answer evaluation and scoring
- 📈 **Usage Tracking** - Monitor AI usage and costs

### Security & Access Management
- 🔐 **Multi-Factor Authentication (MFA)** - TOTP-based 2FA
- 📝 **Audit Logging** - Comprehensive activity tracking
- 🔒 **Session Management** - Active session monitoring and control
- 📱 **Device Management** - Trusted device tracking
- ⚠️ **Risk Assessment** - Security risk scoring
- 🔄 **RBAC Versioning** - Role permission history and rollback

### Integrations
- 📧 **Email (Resend)** - Automated email notifications
- 📅 **Google Calendar** - OAuth integration for scheduling
- 📅 **Microsoft Calendar** - Outlook calendar sync
- 🎥 **LiveKit** - Real-time video interviews
- ☁️ **AWS S3** - File storage for resumes and documents
- 🔗 **LLM Core Services** - Flexible AI provider abstraction (OpenAI, Groq, etc.)

## 📋 Prerequisites

- **Node.js** 18+ 
- **PostgreSQL** database (Neon, Supabase, or local)
- **npm** or **yarn**

## 🛠️ Quick Start

### 1. Clone and Install

```bash
cd Qhire_Full_Production

# Install dependencies
npm install
```

### 2. Environment Setup

Create a `.env` file in the root directory:

```env
# Database
DATABASE_URL="postgresql://user:password@host:5432/database"

# NextAuth
NEXTAUTH_SECRET="your-secret-key" # Generate with: openssl rand -base64 32
NEXTAUTH_URL="http://localhost:3000"

# AI Provider (Choose one)
# Option 1: OpenAI
OPENAI_API_KEY="sk-..."
AI_PROVIDER="openai"

# Option 2: LLM Core Services (Groq, etc.)
LLM_CORE_URL="https://api.groq.com/openai/v1"
LLM_CORE_API_KEY="gsk_..."
LLM_CORE_MODEL="llama-3.1-8b-instant"
AI_PROVIDER="llm-core"

# Embeddings
LLM_CORE_EMBEDDING_MODEL="text-embedding-3-small"
EMBEDDING_DIMENSIONS=1536

# Email (Resend)
RESEND_API_KEY="re_..."
RESEND_FROM_EMAIL="noreply@yourdomain.com"

# Calendar OAuth
GOOGLE_CLIENT_ID="..."
GOOGLE_CLIENT_SECRET="..."
GOOGLE_REDIRECT_URI="http://localhost:3000/api/calendar/google/callback"

MICROSOFT_CLIENT_ID="..."
MICROSOFT_CLIENT_SECRET="..."
MICROSOFT_TENANT_ID="..."
MICROSOFT_REDIRECT_URI="http://localhost:3000/api/calendar/microsoft/callback"

# LiveKit (AI Interviews)
LIVEKIT_API_KEY="..."
LIVEKIT_SECRET="..."
LIVEKIT_URL="wss://your-livekit-server.com"

# AWS S3 (Optional - for file uploads)
AWS_ACCESS_KEY_ID="..."
AWS_SECRET_ACCESS_KEY="..."
S3_BUCKET_NAME="..."
S3_REGION="us-east-1"

# Optional Integrations
APIFY_API_TOKEN="..." # LinkedIn scraping
GMAIL_CLIENT_ID="..." # Gmail OAuth
GMAIL_CLIENT_SECRET="..."
VAPI_API_KEY="..." # Voice assessment calls
DOCUSIGN_INTEGRATION_KEY="..." # E-signatures
```

### 3. Database Setup

```bash
# Run migrations
npx prisma migrate dev

# Generate Prisma client
npx prisma generate

# (Optional) Seed database
npm run db:seed
```

### 4. Start Development Server

```bash
npm run dev
```

Visit `http://localhost:3000`

## 📁 Project Structure

```
Qhire_Full_Production/
├── app/
│   ├── api/                    # API routes
│   │   ├── ai/                 # AI services (chat, interview, parsing)
│   │   ├── calendar/           # Calendar events
│   │   ├── candidates/         # Candidate management
│   │   ├── jobs/               # Job management
│   │   ├── applications/       # Application pipeline
│   │   ├── auth/               # Authentication (MFA, sessions)
│   │   ├── security/           # Security features (audit, devices)
│   │   └── rbac/               # Role-based access control
│   ├── auth/                   # Auth pages (signin, signup)
│   ├── dashboard/              # Role-specific dashboards
│   ├── candidates/             # Candidate pages
│   ├── jobs/                   # Job pages
│   ├── pipeline/               # Pipeline board
│   ├── calendar/               # Calendar & scheduling
│   ├── interview/              # AI interview room
│   ├── recruiter/              # Recruiter tools (bulk upload)
│   ├── settings/               # User settings
│   └── audit/                  # Audit logs (Admin)
│
├── components/
│   ├── layout/                 # Dashboard layout (TopBar, Sidebar)
│   ├── interview/              # AI interview components
│   ├── recruiter/               # Recruiter tools
│   ├── security/               # Security components (MFA, sessions)
│   └── providers/              # Context providers (Theme, Session)
│
├── lib/
│   ├── ai/                     # AI services
│   │   ├── provider.js         # AI provider abstraction
│   │   ├── chat.js             # AI chat
│   │   ├── resume-parser.js    # Resume parsing
│   │   ├── embeddings.js       # Vector embeddings
│   │   └── usage-tracker.js    # Usage tracking
│   ├── calendar/               # Calendar integrations
│   ├── permissions/            # RBAC logic
│   ├── security/               # Security utilities
│   ├── auth.js                 # NextAuth configuration
│   ├── db.js                   # Prisma client
│   └── fetch.js                # API utilities
│
├── prisma/
│   ├── schema.prisma           # Database schema
│   └── migrations/             # Migration history
│
└── docs/                       # Documentation
    ├── AI_INTERVIEW_SETUP.md
    ├── CALENDAR_OAUTH_SETUP.md
    ├── DEPLOYMENT_GUIDE.md
    └── TESTING_GUIDE.md
```

## 🎯 Key Features Explained

### AI Interview System

State machine-driven interviews with voice detection:

1. **AI_SPEAKING** - AI asks question with text-to-speech
2. **LISTENING** - Candidate answers with speech-to-text
3. **SILENCE_DETECTED** - 3.5s silence triggers processing
4. **PROCESSING** - AI analyzes answer
5. **NEXT_READY** - Auto-advance or manual next
6. **COMPLETE** - Generate comprehensive report

**Access:** Schedule interview → Join from calendar → Complete interview → View report

### Bulk Resume Upload

1. Upload multiple PDFs/DOCX files
2. AI parses each resume
3. Auto-fills candidate profiles
4. Batch import to database

**Access:** Recruiter Dashboard → Bulk Upload

### Calendar Integration

- Schedule AI or Human interviews
- Google/Microsoft Calendar OAuth
- Sync events bidirectionally
- View in week/day/month views

**Access:** Calendar → Schedule Interview

### Security Features

- **MFA Setup:** Settings → Security → Enable MFA
- **Session Management:** Settings → Security → Active Sessions
- **Device Management:** Settings → Security → Trusted Devices
- **Audit Logs:** Admin → Audit Logs

## 🔧 Technology Stack

- **Framework:** Next.js 14 (App Router)
- **UI:** React 18, Tailwind CSS
- **Database:** PostgreSQL with Prisma ORM
- **Authentication:** NextAuth.js
- **AI:** OpenAI / Groq / LLM Core Services
- **Video:** LiveKit
- **Email:** Resend
- **Storage:** AWS S3
- **Calendar:** Google Calendar API, Microsoft Graph API

## 📚 Documentation

- **[AI Interview Setup](./docs/AI_INTERVIEW_SETUP.md)** - Configure AI interviews
- **[Calendar OAuth Setup](./docs/CALENDAR_OAUTH_SETUP.md)** - Google/Microsoft integration
- **[Deployment Guide](./docs/DEPLOYMENT_GUIDE.md)** - Production deployment
- **[Testing Guide](./docs/TESTING_GUIDE.md)** - Feature testing instructions
- **[Project Structure](./docs/PROJECT_STRUCTURE.md)** - Detailed architecture

## 🚢 Deployment

### Quick Deploy (Vercel)

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel
```

### Docker Deployment

```bash
# Build
docker build -t qhire .

# Run
docker run -p 3000:3000 --env-file .env qhire
```

See [DEPLOYMENT_GUIDE.md](./docs/DEPLOYMENT_GUIDE.md) for detailed instructions.

## 🔐 Security Best Practices

- ✅ Environment variables for all secrets
- ✅ RBAC with granular permissions
- ✅ MFA for sensitive accounts
- ✅ Session management and device tracking
- ✅ Audit logging for compliance
- ✅ Input validation and sanitization
- ✅ SQL injection prevention (Prisma)

## 🧪 Testing

```bash
# Run tests (if configured)
npm test

# Test specific features
# See docs/TESTING_GUIDE.md
```

## 📊 AI Usage Tracking

Monitor AI usage and costs:
- **Access:** Admin → AI Governance → Usage Dashboard
- **Metrics:** Tokens used, costs, per-feature breakdown
- **Providers:** OpenAI, Groq, LLM Core Services

## 🎨 UI/UX Features

- **Dark Mode** - System-aware theme switching
- **Responsive Design** - Mobile-friendly layouts
- **Role-Specific Dashboards** - Tailored for Admin, Recruiter, Hiring Manager
- **Clean Interface** - Professional, enterprise-grade design

## 🐛 Troubleshooting

### Common Issues

**Database Connection Error**
- Check `DATABASE_URL` in `.env`
- Ensure PostgreSQL is running
- Run `npx prisma migrate dev`

**AI Interview Not Working**
- Verify `LIVEKIT_*` credentials
- Check browser microphone permissions
- Ensure `AI_PROVIDER` is set correctly

**Calendar OAuth Failing**
- Verify redirect URIs match exactly
- Check client ID/secret in `.env`
- See [CALENDAR_OAUTH_SETUP.md](./docs/CALENDAR_OAUTH_SETUP.md)

**Resume Parsing Errors**
- Check `AI_PROVIDER` and API keys
- Verify file format (PDF/DOCX)
- Check rate limits

## 🤝 Contributing

1. Check `docs/` for implementation guides
2. Follow existing code patterns
3. Update documentation
4. Test thoroughly

## 📝 License

Proprietary - All rights reserved

## 🆘 Support

For issues or questions:
- Check documentation in `docs/`
- Review API routes in `app/api/`
- Check Prisma schema: `prisma/schema.prisma`

---

**Last Updated:** December 19, 2025

**Version:** 1.0.0
