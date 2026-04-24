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
const SUBJECT_AR = 'تأكيد موعد صيانة المركبة - شركة الأوائل للتأجير'

interface Payload {
  to:                string
  customer_name:     string
  appointment_type?: string | null
  vehicle_plate?:    string | null
  vehicle_label?:    string | null
  scheduled_date?:   string | null
  scheduled_time?:   string | null
  workshop?:         string | null
  summary_ar?:       string | null
}

function esc(v: string | null | undefined): string {
  if (v == null) return ''
  return String(v)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#039;')
}

function buildHtml(p: Payload): string {
  const appointmentLine = p.summary_ar
    || [p.scheduled_date, p.scheduled_time].filter(Boolean).join(' — ')

  const rows: Array<[string, string]> = []
  if (p.customer_name)    rows.push(['اسم العميل',        p.customer_name])
  if (p.appointment_type) rows.push(['نوع الموعد',        p.appointment_type])
  if (p.vehicle_plate)    rows.push(['رقم اللوحة',        p.vehicle_plate])
  if (p.vehicle_label)    rows.push(['المركبة',           p.vehicle_label])
  if (p.scheduled_date)   rows.push(['تاريخ الموعد',      p.scheduled_date])
  if (p.scheduled_time)   rows.push(['وقت الموعد',        p.scheduled_time])
  if (p.workshop)         rows.push(['الورشة / الموقع',   p.workshop])

  const detailRows = rows.map(([k, v]) => `
    <tr>
      <td style="padding:10px 14px;font-size:13px;color:#64748b;border-bottom:1px solid #f1f5f9;white-space:nowrap;">${esc(k)}</td>
      <td style="padding:10px 14px;font-size:14px;color:#0b1220;font-weight:700;border-bottom:1px solid #f1f5f9;">${esc(v)}</td>
    </tr>
  `).join('')

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${esc(SUBJECT_AR)}</title>
</head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:'Segoe UI',Tahoma,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0"
             style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.04);border:1px solid #e5e7eb;">

        <!-- Header -->
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

        <!-- Hero -->
        <tr>
          <td style="padding:28px 28px 8px;text-align:right;">
            <div style="display:inline-block;background:#FEE2E2;color:#B91C1C;padding:6px 12px;border-radius:999px;font-size:12px;font-weight:700;">
              تأكيد موعد
            </div>
            <h1 style="margin:14px 0 0;font-size:22px;color:#0b1220;font-weight:800;">
              تم تأكيد موعد صيانة مركبتك
            </h1>
          </td>
        </tr>

        <!-- Message -->
        <tr>
          <td style="padding:14px 28px 6px;text-align:right;color:#334155;font-size:15px;line-height:1.9;">
            <p style="margin:0 0 10px;">عزيزي العميل،</p>
            <p style="margin:0 0 10px;">
              تم تأكيد موعد صيانة مركبتك بنجاح لدى <strong style="color:#0b1220;">شركة الأوائل للتأجير</strong>.
            </p>
            <p style="margin:0 0 4px;">
              يرجى الحضور في الوقت المحدد لضمان تقديم الخدمة بالشكل المناسب.
            </p>
          </td>
        </tr>

        <!-- Appointment card -->
        <tr>
          <td style="padding:16px 28px 10px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
                   style="border:1px solid #e5e7eb;border-radius:10px;overflow:hidden;background:#ffffff;">
              <tr>
                <td style="background:#fef2f2;padding:10px 14px;border-bottom:1px solid #fecaca;">
                  <div style="font-size:12px;color:#B91C1C;font-weight:700;letter-spacing:0.4px;">
                    تفاصيل الموعد
                  </div>
                  ${appointmentLine ? `<div style="font-size:15px;color:#0b1220;font-weight:800;margin-top:3px;">${esc(appointmentLine)}</div>` : ''}
                </td>
              </tr>
              <tr><td>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  ${detailRows || `<tr><td style="padding:14px;color:#94a3b8;font-size:13px;">لا توجد تفاصيل إضافية.</td></tr>`}
                </table>
              </td></tr>
            </table>
          </td>
        </tr>

        <!-- Sign-off -->
        <tr>
          <td style="padding:20px 28px 4px;text-align:right;color:#334155;font-size:14px;line-height:1.9;">
            <p style="margin:0;">فريق الصيانة</p>
            <p style="margin:0;color:#0b1220;font-weight:700;">شركة الأوائل للتأجير</p>
            <p style="margin:0;color:#64748b;font-size:12px;">Pioneer Lease</p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:18px 28px;border-top:1px solid #e5e7eb;background:#fafafa;text-align:center;color:#94a3b8;font-size:11px;">
            هذه رسالة تلقائية من نظام إدارة المركبات. الرجاء عدم الرد عليها.
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
        subject: SUBJECT_AR,
        htmlContent: html,
      }),
    })

    const result = await res.json().catch(() => null)

    if (!res.ok) {
      console.error('[Brevo] failed to send appointment email', {
        status: res.status,
        result,
      })

      return NextResponse.json(
        {
          success: false,
          error: result?.message || 'Failed to send email',
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
