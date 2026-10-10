import { escapeHtml, renderBaseLayout } from './base-layout.js'

export interface RequestDeadlineMailData {
  recipientName: string
  requestTitle: string
  toDivisionName: string
  deadline: Date | string
  isToday: boolean
  requestUrl: string
}

export function renderRequestDeadlineMail(data: RequestDeadlineMailData): { html: string; text: string } {
  const deadlineBadge = data.isToday
    ? { bg: '#fee2e2', text: '#b91c1c', label: '🚨 TARGET SELESAI HARI INI' }
    : { bg: '#fef3c7', text: '#b45309', label: '⚠️ TARGET SELESAI BESOK (H-1)' }

  const formattedDate = new Date(data.deadline).toLocaleDateString('id-ID', {
    dateStyle: 'full',
  })

  const contentHtml = `
    <p style="font-size: 15px; color: #334155; margin-top: 0;">Halo <strong>${escapeHtml(data.recipientName)}</strong>,</p>

    <div style="margin-bottom: 16px;">
      <span style="background-color: ${deadlineBadge.bg}; color: ${deadlineBadge.text}; padding: 4px 10px; border-radius: 6px; font-size: 12px; font-weight: 700; display: inline-block;">
        ${deadlineBadge.label}
      </span>
      <span style="color: #64748b; font-size: 13px; margin-left: 8px;">Divisi: ${escapeHtml(data.toDivisionName)}</span>
    </div>

    <h2 style="margin: 0 0 16px 0; font-size: 18px; font-weight: 700; color: #0f172a; line-height: 1.4;">
      ${escapeHtml(data.requestTitle)}
    </h2>

    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 16px 0; font-size: 14px;">
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="color: #64748b; padding: 4px 0; width: 140px;">Batas Target:</td>
          <td style="color: #0f172a; font-weight: 600; padding: 4px 0;">${escapeHtml(formattedDate)}</td>
        </tr>
        <tr>
          <td style="color: #64748b; padding: 4px 0;">Divisi Pelaksana:</td>
          <td style="color: #0f172a; font-weight: 500; padding: 4px 0;">${escapeHtml(data.toDivisionName)}</td>
        </tr>
      </table>
    </div>

    <p style="color: #475569; font-size: 14px; margin-top: 20px;">
      Mohon periksa perkembangan pekerjaan request ini untuk memastikan hasil dapat dikirimkan tepat waktu.
    </p>
  `

  const html = renderBaseLayout({
    title: `Pengingat Target Request: ${data.requestTitle}`,
    preheader: `${deadlineBadge.label} untuk request: ${data.requestTitle}`,
    contentHtml,
    ctaText: 'Buka Permohonan',
    ctaUrl: data.requestUrl,
  })

  const text = `[PENGINGAT TARGET REQUEST MOASPACE]
Halo ${data.recipientName},

Permohonan antar divisi berikut memiliki ${deadlineBadge.label}:
- Judul: ${data.requestTitle}
- Divisi Pelaksana: ${data.toDivisionName}
- Batas Target: ${formattedDate}

Buka di MoaSpace: ${data.requestUrl}`

  return { html, text }
}
