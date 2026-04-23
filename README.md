# VMS — Vehicle Management System

A clean Next.js + TypeScript starter template for building a vehicle/fleet management system.

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: TailwindCSS
- **UI**: Lucide icons, Recharts / ApexCharts
- **State**: Zustand
- **Forms**: React Hook Form + Zod
- **Backend (optional)**: Supabase (auth + DB). Not connected by default.

## Getting Started

```bash
npm install
npm run dev
```

Then open http://localhost:3000.

## Environment

Copy `.env.local` and fill in your own values. By default the Supabase credentials are empty
and the app runs in a safe offline/template mode.

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

## Project Structure

- `src/app` — Next.js App Router pages, layouts, and API routes
- `src/components` — Reusable UI components (layout, dashboard, forms, settings)
- `src/lib` — Utilities, i18n translations, Supabase helpers, PDF/Excel exports
- `src/hooks` — Shared React hooks
- `supabase/migrations` — Optional SQL migrations (only used if Supabase is configured)

## Notes

This project is a **clean starter template**. All previous business identity, branding,
and credentials have been removed. Customize the name, translations, navigation, and
data models to fit your own system.
