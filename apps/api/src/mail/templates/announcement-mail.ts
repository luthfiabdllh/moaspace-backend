import { escapeHtml, renderBaseLayout, formatDateTimeWib } from './base-layout.js'

export interface AnnouncementMailData {
  title: string
  category: string
  authorName: string
  targetType: string
  divisionName?: string
  subunitName?: string
  clusterName?: string
  eventStartDate?: Date | string | null
  location?: string | null
  summaryText?: string
  bodyHtml?: string
  announcementUrl: string
}

const CATEGORY_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  URGENT: { bg: '#fee2e2', text: '#dc2626', label: 'Penting / Mendesak' },
  MEETING: { bg: '#e0e7ff', text: '#4338ca', label: 'Rapat / Briefing' },
  ACTIVITY: { bg: '#dcfce7', text: '#15803d', label: 'Kegiatan Lapangan' },
  INFO: { bg: '#e0f2fe', text: '#0369a1', label: 'Informasi Umum' },
}

export function renderAnnouncementMail(data: AnnouncementMailData): { html: string; text: string } {
  const defaultCat = { bg: '#e0f2fe', text: '#0369a1', label: 'Informasi Umum' }
  const cat = (data.category ? CATEGORY_COLORS[data.category] : undefined) ?? defaultCat
  let targetLabel = 'Seluruh Tim'
  if (data.targetType === 'DIVISION') {
    targetLabel = `Divisi ${data.divisionName ?? ''}`
  } else if (data.targetType === 'SUBUNIT') {
    targetLabel = `Posko / Subunit ${data.subunitName ?? ''}`
  } else if (data.targetType === 'CLUSTER') {
    targetLabel = `Klaster ${data.clusterName ?? ''}`
  }

  let eventInfoHtml = ''
  if (data.eventStartDate) {
    const formattedDate = formatDateTimeWib(data.eventStartDate)
    eventInfoHtml = `
      <div style="background-color: #f1f5f9; border-radius: 8px; padding: 12px 16px; margin: 16px 0; font-size: 14px;">
        <div style="color: #475569; font-size: 12px; font-weight: 600; text-transform: uppercase; margin-bottom: 4px;">📅 Jadwal Agenda</div>
        <div style="color: #0f172a; font-weight: 600;">${escapeHtml(formattedDate)}</div>
        ${data.location ? `<div style="color: #334155; margin-top: 4px;">📍 Lokasi: <strong>${escapeHtml(data.location)}</strong></div>` : ''}
      </div>
    `
  }

  const contentHtml = `
    <div style="margin-bottom: 20px;">
      <span style="background-color: ${cat.bg}; color: ${cat.text}; padding: 4px 10px; border-radius: 6px; font-size: 12px; font-weight: 700; display: inline-block;">
        ${cat.label}
      </span>
      <span style="color: #64748b; font-size: 13px; margin-left: 8px;">Target: ${escapeHtml(targetLabel)}</span>
    </div>

    <h2 style="margin: 0 0 12px 0; font-size: 20px; font-weight: 700; color: #0f172a; line-height: 1.3;">
      ${escapeHtml(data.title)}
    </h2>

    <p style="color: #64748b; font-size: 13px; margin: 0 0 16px 0;">
      Diumumkan oleh: <strong>${escapeHtml(data.authorName)}</strong>
    </p>

    ${eventInfoHtml}

    ${
      data.bodyHtml
        ? `
      <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin: 20px 0;">
        <div style="color: #64748b; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 12px;">
          Isi Pengumuman
        </div>
        <div style="color: #1e293b; font-size: 15px; line-height: 1.6;">
          ${data.bodyHtml}
        </div>
      </div>
      `
        : data.summaryText
          ? `<div style="color: #334155; font-size: 15px; margin: 16px 0; line-height: 1.6;">${escapeHtml(data.summaryText)}</div>`
          : ''
    }

    <p style="color: #475569; font-size: 14px; margin-top: 20px;">
      Buka MoaSpace untuk membaca pengumuman selengkapnya dan berinteraksi dengan tim.
    </p>
  `

  const html = renderBaseLayout({
    title: `Pengumuman: ${data.title}`,
    preheader: `Pengumuman baru dari ${data.authorName} untuk ${targetLabel}`,
    contentHtml,
    ctaText: 'Buka Pengumuman',
    ctaUrl: data.announcementUrl,
  })

  const text = `[PENGUMUMAN MOASPACE: ${cat.label.toUpperCase()}]
${data.title}
Diumumkan oleh: ${data.authorName} (${targetLabel})

${
    data.eventStartDate ? `Jadwal: ${formatDateTimeWib(data.eventStartDate)}\nLokasi: ${data.location ?? '-'}\n\n` : ''
  }${data.summaryText ? `Isi Pengumuman:\n${data.summaryText}\n\n` : ''}Buka pengumuman lengkap: ${data.announcementUrl}`

  return { html, text }
}
