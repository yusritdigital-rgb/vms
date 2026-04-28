// =====================================================
// POST /api/appointments/send-confirmation
// -----------------------------------------------------
// Sends a professional bilingual confirmation email to the customer
// after an appointment is created, using Brevo (Sendinblue).
//
// Server-side only. `BREVO_API_KEY` is never exposed to the client.
// Called after the appointment row is already saved — failure here
// must NOT break appointment creation, so callers treat a non-OK
// response as a soft-warning only.
// =====================================================

import { NextRequest, NextResponse } from 'next/server'

const BREVO_ENDPOINT = 'https://api.brevo.com/v3/smtp/email'
// Bilingual subject — Arabic first (primary audience), English mirror
// after the separator so non-Arabic mail clients still see meaningful
// text in their preview pane.
const SUBJECT_BILINGUAL =
  'تأكيد موعد صيانة المركبة · Appointment Confirmation — Pioneer Lease'

/** Map the canonical appointment-type keys to Arabic + English labels.
 *  Mirrors `TYPE_LABEL_AR` in `@/lib/appointments/types` (kept inline
 *  to avoid pulling client code into the API route bundle). */
const TYPE_LABEL_AR_MAP: Record<string, string> = {
  maintenance: 'صيانة',
  inspection:  'معاينة',
  delivery:    'تسليم',
  other:       'أخرى',
}
const TYPE_LABEL_EN_MAP: Record<string, string> = {
  maintenance: 'Maintenance',
  inspection:  'Inspection',
  delivery:    'Delivery',
  other:       'Other',
}

interface Payload {
  to:                    string
  customer_name:         string
  /** Canonical APT-… reference number. Customers quote this when they
   *  contact the workshop. */
  appointment_number?:   string | null
  /** Raw type key (maintenance/inspection/…). Preferred over the
   *  pre-rendered label — lets the route emit AR + EN. */
  appointment_type_key?: string | null
  /** Pre-rendered Arabic label (legacy fallback). */
  appointment_type?:     string | null
  vehicle_plate?:        string | null
  vehicle_label?:        string | null
  scheduled_date?:       string | null
  /** Pre-formatted Arabic time label (e.g. "10:00 ص"). */
  scheduled_time?:       string | null
  /** Raw HH:MM clock value, used to format the English time label. */
  scheduled_time_raw?:   string | null
  workshop?:             string | null
  summary_ar?:           string | null
}

function esc(v: string | null | undefined): string {
  if (v == null) return ''
  return String(v)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#039;')
}

/** Render an HH:MM clock string as a 12-hour English label. */
function formatTimeEn(hhmm: string | null | undefined): string {
  if (!hhmm) return ''
  const m = /^(\d{1,2}):(\d{2})/.exec(hhmm)
  if (!m) return hhmm
  const h24 = Math.max(0, Math.min(23, parseInt(m[1], 10)))
  const min = m[2]
  const ampm = h24 >= 12 ? 'PM' : 'AM'
  const h12 = ((h24 + 11) % 12) + 1
  return `${h12}:${min} ${ampm}`
}

/** Render YYYY-MM-DD as a long English date (e.g. "Tue, 21 April 2026"). */
function formatDateEn(ymd: string | null | undefined): string {
  if (!ymd) return ''
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(ymd)
  if (!m) return ymd
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]))
  if (Number.isNaN(d.getTime())) return ymd
  return d.toLocaleDateString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'long', year: 'numeric',
    timeZone: 'UTC',
  })
}

/** Build a single key/value detail row for either language. */
function renderDetailRows(rows: Array<[string, string]>, emptyLabel: string): string {
  if (rows.length === 0) {
    return `<tr><td style="padding:14px;color:#94a3b8;font-size:13px;">${esc(emptyLabel)}</td></tr>`
  }
  return rows.map(([k, v]) => `
    <tr>
      <td style="padding:10px 14px;font-size:13px;color:#64748b;border-bottom:1px solid #f1f5f9;white-space:nowrap;">${esc(k)}</td>
      <td style="padding:10px 14px;font-size:14px;color:#0b1220;font-weight:700;border-bottom:1px solid #f1f5f9;">${esc(v)}</td>
    </tr>
  `).join('')
}

function buildHtml(p: Payload): string {
  // ─── Resolve type labels in both languages ───────
  const typeKey = (p.appointment_type_key || '').trim().toLowerCase()
  const typeAr = TYPE_LABEL_AR_MAP[typeKey]
               ?? (p.appointment_type ?? null)
  const typeEn = TYPE_LABEL_EN_MAP[typeKey]
               ?? (typeKey ? typeKey.charAt(0).toUpperCase() + typeKey.slice(1) : null)

  // ─── Pre-rendered summary lines per language ─────
  const summaryAr = p.summary_ar
    || [p.scheduled_date, p.scheduled_time].filter(Boolean).join(' — ')
  const summaryEn = [
    formatDateEn(p.scheduled_date),
    formatTimeEn(p.scheduled_time_raw),
  ].filter(Boolean).join(' — ')

  // ─── Detail rows (Arabic) ────────────────────────
  const arRows: Array<[string, string]> = []
  if (p.appointment_number) arRows.push(['رقم الموعد',       p.appointment_number])
  if (p.customer_name)      arRows.push(['اسم العميل',       p.customer_name])
  if (typeAr)               arRows.push(['نوع الموعد',       typeAr])
  if (p.vehicle_plate)      arRows.push(['رقم اللوحة',       p.vehicle_plate])
  if (p.vehicle_label)      arRows.push(['المركبة',          p.vehicle_label])
  if (p.scheduled_date)     arRows.push(['تاريخ الموعد',     p.scheduled_date])
  if (p.scheduled_time)     arRows.push(['وقت الموعد',       p.scheduled_time])
  if (p.workshop)           arRows.push(['الورشة / الموقع',  p.workshop])

  // ─── Detail rows (English) ───────────────────────
  const enRows: Array<[string, string]> = []
  if (p.appointment_number) enRows.push(['Appointment No.',  p.appointment_number])
  if (p.customer_name)      enRows.push(['Customer',         p.customer_name])
  if (typeEn)               enRows.push(['Type',             typeEn])
  if (p.vehicle_plate)      enRows.push(['Vehicle Plate',    p.vehicle_plate])
  if (p.vehicle_label)      enRows.push(['Vehicle',          p.vehicle_label])
  if (p.scheduled_date)     enRows.push(['Date',             formatDateEn(p.scheduled_date) || p.scheduled_date])
  if (p.scheduled_time_raw) enRows.push(['Time',             formatTimeEn(p.scheduled_time_raw)])
  if (p.workshop)           enRows.push(['Workshop',         p.workshop])

  const arDetail = renderDetailRows(arRows, 'لا توجد تفاصيل إضافية.')
  const enDetail = renderDetailRows(enRows, 'No additional details.')

  // ─── Big appointment-number badge (shared, language-neutral) ───
  const aptBadge = p.appointment_number
    ? `
        <tr>
          <td style="padding:18px 28px 4px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
                   style="border:1px solid #fecaca;border-radius:10px;background:#fff7f7;">
              <tr>
                <td style="padding:14px 18px;text-align:center;">
                  <div style="font-size:11px;color:#B91C1C;font-weight:700;letter-spacing:0.6px;text-transform:uppercase;">
                    رقم الموعد · Appointment Reference
                  </div>
                  <div style="font-size:24px;color:#0b1220;font-weight:800;margin-top:6px;font-family:'Courier New',monospace;letter-spacing:1px;">
                    ${esc(p.appointment_number)}
                  </div>
                  <div style="font-size:11px;color:#64748b;margin-top:6px;line-height:1.6;">
                    يرجى ذكر هذا الرقم عند التواصل معنا.<br/>
                    Please quote this number when contacting us.
                  </div>
                </td>
              </tr>
            </table>
          </td>
        </tr>`
    : ''

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${esc(SUBJECT_BILINGUAL)}</title>
</head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:'Segoe UI',Tahoma,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0"
             style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.04);border:1px solid #e5e7eb;">

        <!-- Header (Pioneer Lease branding — preserved) -->
        <tr>
          <td style="background:#ffffff;padding:22px 28px;border-bottom:3px solid #B91C1C;">
            <table role="presentation" width="100%"><tr>
              <td style="text-align:right;">
                <div style="font-size:20px;font-weight:800;color:#0b1220;letter-spacing:0.2px;">
                  شركة الأوائل للتأجير
                </div>
                <div style="font-size:12px;color:#64748b;margin-top:2px;letter-spacing:0.4px;">
                  Pioneer Lease · Vehicle Management System
                </div>
              </td>
            </tr></table>
          </td>
        </tr>

        <!-- Prominent appointment-reference badge (bilingual) -->
        ${aptBadge}

        <!-- ═══════════ ARABIC SECTION (RTL) ═══════════ -->
        <tr>
          <td dir="rtl" style="padding:22px 28px 6px;text-align:right;">
            <div style="display:inline-block;background:#FEE2E2;color:#B91C1C;padding:5px 11px;border-radius:999px;font-size:11px;font-weight:700;letter-spacing:0.4px;">
              العربية
            </div>
            <h1 style="margin:12px 0 0;font-size:21px;color:#0b1220;font-weight:800;">
              تم تأكيد موعد صيانة مركبتك
            </h1>
          </td>
        </tr>
        <tr>
          <td dir="rtl" style="padding:10px 28px 6px;text-align:right;color:#334155;font-size:14.5px;line-height:1.9;">
            <p style="margin:0 0 8px;">عزيزي ${esc(p.customer_name) || 'العميل'},</p>
            <p style="margin:0 0 8px;">
              تم تأكيد موعد صيانة مركبتك بنجاح لدى <strong style="color:#0b1220;">شركة الأوائل للتأجير</strong>.
            </p>
            <p style="margin:0 0 4px;">
              يرجى الحضور في الوقت المحدد، وذكر <strong style="color:#B91C1C;">رقم الموعد</strong> عند التواصل مع فريق الصيانة لأي استفسار.
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:14px 28px 6px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" dir="rtl"
                   style="border:1px solid #e5e7eb;border-radius:10px;overflow:hidden;background:#ffffff;">
              <tr>
                <td style="background:#fef2f2;padding:9px 14px;border-bottom:1px solid #fecaca;">
                  <div style="font-size:12px;color:#B91C1C;font-weight:700;letter-spacing:0.4px;">
                    تفاصيل الموعد
                  </div>
                  ${summaryAr ? `<div style="font-size:14.5px;color:#0b1220;font-weight:800;margin-top:3px;">${esc(summaryAr)}</div>` : ''}
                </td>
              </tr>
              <tr><td>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  ${arDetail}
                </table>
              </td></tr>
            </table>
          </td>
        </tr>
        <tr>
          <td dir="rtl" style="padding:14px 28px 6px;text-align:right;color:#334155;font-size:13.5px;line-height:1.8;">
            <p style="margin:0;">فريق الصيانة</p>
            <p style="margin:0;color:#0b1220;font-weight:700;">شركة الأوائل للتأجير</p>
          </td>
        </tr>

        <!-- Section divider -->
        <tr>
          <td style="padding:8px 28px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="border-top:1px dashed #e5e7eb;font-size:0;line-height:0;height:1px;">&nbsp;</td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- ═══════════ ENGLISH SECTION (LTR) ═══════════ -->
        <tr>
          <td dir="ltr" style="padding:8px 28px 6px;text-align:left;">
            <div style="display:inline-block;background:#FEE2E2;color:#B91C1C;padding:5px 11px;border-radius:999px;font-size:11px;font-weight:700;letter-spacing:0.4px;">
              English
            </div>
            <h2 style="margin:12px 0 0;font-size:20px;color:#0b1220;font-weight:800;">
              Your service appointment is confirmed
            </h2>
          </td>
        </tr>
        <tr>
          <td dir="ltr" style="padding:10px 28px 6px;text-align:left;color:#334155;font-size:14.5px;line-height:1.9;">
            <p style="margin:0 0 8px;">Dear ${esc(p.customer_name) || 'Customer'},</p>
            <p style="margin:0 0 8px;">
              Your vehicle service appointment with <strong style="color:#0b1220;">Pioneer Lease</strong> has been confirmed.
            </p>
            <p style="margin:0 0 4px;">
              Please arrive at the scheduled time, and quote your <strong style="color:#B91C1C;">Appointment Number</strong> whenever you contact our service team.
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:6px 28px 6px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" dir="ltr"
                   style="border:1px solid #e5e7eb;border-radius:10px;overflow:hidden;background:#ffffff;">
              <tr>
                <td style="background:#fef2f2;padding:9px 14px;border-bottom:1px solid #fecaca;">
                  <div style="font-size:12px;color:#B91C1C;font-weight:700;letter-spacing:0.4px;">
                    APPOINTMENT DETAILS
                  </div>
                  ${summaryEn ? `<div style="font-size:14.5px;color:#0b1220;font-weight:800;margin-top:3px;">${esc(summaryEn)}</div>` : ''}
                </td>
              </tr>
              <tr><td>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  ${enDetail}
                </table>
              </td></tr>
            </table>
          </td>
        </tr>
        <tr>
          <td dir="ltr" style="padding:14px 28px 18px;text-align:left;color:#334155;font-size:13.5px;line-height:1.8;">
            <p style="margin:0;">Service Team</p>
            <p style="margin:0;color:#0b1220;font-weight:700;">Pioneer Lease</p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:14px 28px;border-top:1px solid #e5e7eb;background:#fafafa;text-align:center;color:#94a3b8;font-size:11px;line-height:1.7;">
            هذه رسالة تلقائية من نظام إدارة المركبات. الرجاء عدم الرد عليها.<br/>
            This is an automated message from the Vehicle Management System. Please do not reply.
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.BREVO_API_KEY
  if (!apiKey) {
    console.error('[Brevo] BREVO_API_KEY not configured')
    return NextResponse.json(
      { success: false, error: 'brevo_api_key_not_configured' },
      { status: 500 }
    )
  }

  const senderEmail = process.env.BREVO_SENDER_EMAIL
  if (!senderEmail) {
    console.warn('[Brevo] BREVO_SENDER_EMAIL not configured, using fallback')
  }

  let body: Payload
  try {
    body = (await request.json()) as Payload
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 })
  }

  const to = (body.to || '').trim()
  if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
    return NextResponse.json({ ok: false, error: 'invalid_email' }, { status: 400 })
  }

  const html = buildHtml(body)

  try {
    const res = await fetch(BREVO_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': apiKey,
      },
      body: JSON.stringify({
        sender: {
          name: 'Pioneer Lease',
          email: senderEmail || 'YOUR_VERIFIED_BREVO_EMAIL',
        },
        to: [
          {
            email: to,
            name: body.customer_name || 'Customer',
          },
        ],
        subject: SUBJECT_BILINGUAL,
        htmlContent: html,
      }),
    })

    const result = await res.json().catch(() => null)

    if (!res.ok) {
      console.error('[Brevo appointment email failed]', {
        status: res.status,
        result,
        sender: senderEmail,
        hasApiKey: Boolean(apiKey),
      })

      return NextResponse.json(
        {
          success: false,
          error: result?.message || result?.code || 'Failed to send email',
          details: result,
        },
        { status: 200 }
      )
    }

    return NextResponse.json({
      success: true,
      result,
    })
  } catch (err: any) {
    console.error('[Brevo] network error', err)
    return NextResponse.json(
      {
        success: false,
        error: 'network_error',
        message: err?.message || String(err),
      },
      { status: 200 }
    )
  }
}
