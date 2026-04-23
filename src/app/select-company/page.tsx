// /select-company is DEPRECATED.
//
// The track-based access model replaced company-based selection. Every
// authenticated user either:
//   - is a system_admin (full access), or
//   - has a track = 'maintenance' | 'operations' | null (null = see-all)
//
// In all cases, the user is taken straight to /dashboard. This stub exists
// only so a bookmarked or stale link cannot 404 — it force-redirects on the
// server immediately. The middleware also intercepts this path as a belt-
// and-suspenders guard.

import { redirect } from 'next/navigation'

export default function SelectCompanyDeprecated(): never {
  redirect('/dashboard')
}
