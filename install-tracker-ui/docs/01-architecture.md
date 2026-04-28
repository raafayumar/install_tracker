# Architecture & Infrastructure

## System Overview

The Install Tracker is a full-stack application for tracking computer vision model installations across customer sites. It consists of three services sharing one PostgreSQL database:

```
                 +-----------+
                 | PostgreSQL|  (port 5433 external, 5432 internal)
                 |   15      |
                 +-----+-----+
                       |
          +------------+------------+
          |                         |
    +-----+------+          +------+------+
    | Streamlit  |          |  Next.js 16 |
    | (Python)   |          | (TypeScript)|
    | port 8503  |          |  port 3001  |
    +------------+          +-------------+
```

Both the Streamlit app (`app/`) and the Next.js frontend (`install-tracker-ui/`) read and write to the same PostgreSQL database. The Streamlit app was built first; the Next.js app is its replacement UI with the same business logic ported to TypeScript.

---

## Docker Compose Setup

**File:** `docker/docker-compose.yml`

Three services:

| Service  | Container Name            | Image/Build          | Port       | Purpose           |
|----------|--------------------------|----------------------|------------|-------------------|
| `db`     | `install_tracker_db`      | `postgres:15`        | 5433:5432  | PostgreSQL DB     |
| `app`    | `install_tracker_app`     | `docker/Dockerfile`  | 8503:8503  | Streamlit app     |
| `nextjs` | `install_tracker_nextjs`  | `install-tracker-ui/Dockerfile` | 3001:3001 | Next.js frontend |

**Database credentials:**
```
User:     install_tracker
Password: install_tracker
Database: install_tracker
```

**Internal Docker networking:**
- Services connect to PostgreSQL via `db:5432` (Docker service name), NOT `localhost`
- The `DATABASE_URL` inside Docker is: `postgresql://install_tracker:install_tracker@db:5432/install_tracker`
- External tools connect via `localhost:5433` (port 5433 is exposed to host)

**Health checks:**
- PostgreSQL has a health check (`pg_isready`)
- Both `app` and `nextjs` depend on `db` with `condition: service_healthy`

---

## Next.js Dockerfile

**File:** `install-tracker-ui/Dockerfile`

Multi-stage build:

1. **`deps`** - Install npm packages + generate Prisma client
2. **`builder`** - Copy source, run `npm run build` (uses `--webpack` flag to avoid Turbopack crashes)
3. **`runner`** - Minimal production image with standalone output

Key details:
- Uses `node:20-alpine` base
- Requires `openssl` (apk) for Prisma
- Build uses a placeholder `DATABASE_URL` (real one is set at runtime)
- Standalone output: copies `.next/standalone` + `.next/static` + Prisma engines
- Runs as non-root user `nextjs` (UID 1001)
- Exposes port 3001 (set via `PORT=3001` env var)

---

## External Access (Production)

The production server has Cloudflare configured to proxy `installs.innovatewithraafay.com` to the server on port 3001. Cloudflare handles SSL termination.

```
Browser → Cloudflare (SSL) → Server:3001 → Next.js container
```

Next.js serves BOTH the pages AND the API routes. There is no separate backend server - the API routes (`/api/*`) are server-side functions handled by Next.js itself.

---

## Next.js Configuration

**File:** `install-tracker-ui/next.config.ts`

```typescript
const nextConfig: NextConfig = {
  output: "standalone",  // Required for Docker deployment
};
```

**File:** `install-tracker-ui/package.json` (scripts)

```json
{
  "dev": "next dev",
  "build": "next build --webpack",   // --webpack avoids Turbopack Rust panics
  "start": "next start",
  "lint": "eslint"
}
```

**Key dependencies:**
- `next@16.2.2` - Next.js 16 with App Router
- `react@19.2.4` - React 19
- `@prisma/client@^6.19.3` - Prisma ORM
- `@tanstack/react-query@^5.96.1` - Server state management
- `recharts@^3.8.1` - Charts
- `lucide-react@^1.7.0` - Icons
- `tailwindcss@^4` - Styling (v4, CSS-based config)

---

## Styling System

Uses Tailwind CSS v4 with **CSS custom properties** (not `tailwind.config.ts`). The theme is defined in `src/app/globals.css` using `@theme inline` blocks.

**Design system: Protex AI Dark Theme**

Key color tokens:
- `--color-page`: Deep navy background
- `--color-card`: Card surface
- `--color-border`: Subtle borders
- `--color-text-primary`: White text
- `--color-text-secondary`: Muted text
- `--color-text-tertiary`: Faded text

Accent colors: Sky blue (`#00a0f2`), Green (`#22c55e`), Orange (`#f5a623`), Red (`#f05252`)

Font: **Montserrat** (loaded via `next/font/google`)

---

## State Management

### Server State (React Query)

All data fetching uses `@tanstack/react-query`. Configuration in `src/app/providers.tsx`:

```typescript
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 0,              // Always refetch - DB is source of truth
      refetchOnWindowFocus: true, // Refresh when user returns to tab
      refetchOnMount: true,       // Refresh on component mount
      retry: 1,                   // Retry once on failure
    },
  },
});
```

**Why `staleTime: 0`?** The Streamlit app may modify data at any time. Setting `staleTime: 0` ensures the Next.js app always shows the latest DB state.

### Client State

- `AppContext` in `providers.tsx` holds `selectedUser` (global user filter)
- Local `useState` for filters, form inputs, toggles

---

## Prisma ORM

**File:** `install-tracker-ui/prisma/schema.prisma`

Prisma connects to the existing PostgreSQL database created by SQLAlchemy (the Streamlit app). The schema was reverse-engineered to match the existing tables.

**Singleton pattern** in `src/lib/prisma.ts`:
```typescript
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };
export const prisma = globalForPrisma.prisma ?? new PrismaClient({ ... });
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
```

This prevents creating multiple Prisma clients during hot-reload in development.

**Important:** All API routes export `export const dynamic = "force-dynamic"` to prevent Next.js from caching responses. Without this, API routes can return stale data.
