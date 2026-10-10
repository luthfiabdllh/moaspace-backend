import { escapeHtml, renderBaseLayout, formatDateWib } from './base-layout.js'

export interface TaskAssignedMailData {
  recipientName: string
  taskTitle: string
  assignerName: string
  divisionName?: string
  priority?: string
  dueDate?: Date | string | null
  taskUrl: string
}

export function renderTaskAssignedMail(data: TaskAssignedMailData): { html: string; text: string } {
  let dueDateHtml = ''
  let dueDateText = ''
  if (data.dueDate) {
    const formattedDate = formatDateWib(data.dueDate)
    dueDateHtml = `
      <tr>
        <td style="color: #64748b; padding: 4px 0; width: 120px;">Batas Waktu:</td>
        <td style="color: #0f172a; font-weight: 600; padding: 4px 0;">${escapeHtml(formattedDate)}</td>
      </tr>
    `
    dueDateText = `- Batas Waktu: ${formattedDate}\n`
  }

  const contentHtml = `
    <p style="font-size: 15px; color: #334155; margin-top: 0;">Halo <strong>${escapeHtml(data.recipientName)}</strong>,</p>

    <div style="margin-bottom: 16px;">
      <span style="background-color: #e0e7ff; color: #4338ca; padding: 4px 10px; border-radius: 6px; font-size: 12px; font-weight: 700; display: inline-block;">
        📌 PENUGASAN TUGAS BARU
      </span>
      ${
        data.divisionName
          ? `<span style="color: #64748b; font-size: 13px; margin-left: 8px;">Divisi: ${escapeHtml(data.divisionName)}</span>`
          : ''
      }
    </div>

    <p style="font-size: 15px; color: #1e293b; line-height: 1.5; margin: 0 0 16px 0;">
      Anda baru saja ditugaskan pada tugas berikut oleh <strong>${escapeHtml(data.assignerName)}</strong>:
    </p>

    <h2 style="margin: 0 0 16px 0; font-size: 18px; font-weight: 700; color: #0f172a; line-height: 1.4;">
      ${escapeHtml(data.taskTitle)}
    </h2>

    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 16px 0; font-size: 14px;">
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="color: #64748b; padding: 4px 0; width: 120px;">Ditugaskan Oleh:</td>
          <td style="color: #0f172a; font-weight: 600; padding: 4px 0;">${escapeHtml(data.assignerName)}</td>
        </tr>
        ${data.priority ? `
          <tr>
            <td style="color: #64748b; padding: 4px 0;">Prioritas:</td>
            <td style="color: #0f172a; font-weight: 600; padding: 4px 0;">${escapeHtml(data.priority)}</td>
          </tr>
        ` : ''}
        ${dueDateHtml}
      </table>
    </div>

    <p style="color: #475569; font-size: 14px; margin-top: 20px;">
      Silakan buka papan kerja MoaSpace untuk melihat instruksi dan mulai mengerjakan tugas ini.
    </p>
  `

  const html = renderBaseLayout({
    title: `Penugasan Tugas: ${data.taskTitle}`,
    preheader: `${data.assignerName} menugaskan Anda pada: ${data.taskTitle}`,
    contentHtml,
    ctaText: 'Lihat Tugas',
    ctaUrl: data.taskUrl,
  })

  const text = `[PENUGASAN TUGAS MOASPACE]
Halo ${data.recipientName},

Anda baru saja ditugaskan oleh ${data.assignerName} pada tugas berikut:
- Judul: ${data.taskTitle}
${data.divisionName ? `- Divisi: ${data.divisionName}\n` : ''}${
    data.priority ? `- Prioritas: ${data.priority}\n` : ''
  }${dueDateText}
Buka tugas: ${data.taskUrl}`

  return { html, text }
}
