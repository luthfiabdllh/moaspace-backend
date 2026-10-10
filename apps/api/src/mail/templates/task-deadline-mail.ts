import { escapeHtml, renderBaseLayout } from './base-layout.js'

export interface TaskDeadlineMailData {
  recipientName: string
  taskTitle: string
  divisionName?: string
  priority?: string
  dueDate: Date | string
  isToday: boolean
  taskUrl: string
}

const PRIORITY_LABELS: Record<string, { label: string; color: string }> = {
  HIGH: { label: 'Tinggi', color: '#dc2626' },
  MEDIUM: { label: 'Sedang', color: '#d97706' },
  LOW: { label: 'Rendah', color: '#2563eb' },
}

export function renderTaskDeadlineMail(data: TaskDeadlineMailData): { html: string; text: string } {
  const deadlineBadge = data.isToday
    ? { bg: '#fee2e2', text: '#b91c1c', label: '🚨 DEADLINE HARI INI' }
    : { bg: '#fef3c7', text: '#b45309', label: '⚠️ DEADLINE BESOK (H-1)' }

  const formattedDate = new Date(data.dueDate).toLocaleDateString('id-ID', {
    dateStyle: 'full',
  })

  const defaultPriority = { label: 'Sedang', color: '#d97706' }
  const priority = (data.priority ? PRIORITY_LABELS[data.priority] : null) ?? defaultPriority

  const contentHtml = `
    <p style="font-size: 15px; color: #334155; margin-top: 0;">Halo <strong>${escapeHtml(data.recipientName)}</strong>,</p>

    <div style="margin-bottom: 16px;">
      <span style="background-color: ${deadlineBadge.bg}; color: ${deadlineBadge.text}; padding: 4px 10px; border-radius: 6px; font-size: 12px; font-weight: 700; display: inline-block;">
        ${deadlineBadge.label}
      </span>
      ${
        data.divisionName
          ? `<span style="color: #64748b; font-size: 13px; margin-left: 8px;">Divisi: ${escapeHtml(data.divisionName)}</span>`
          : ''
      }
    </div>

    <h2 style="margin: 0 0 16px 0; font-size: 18px; font-weight: 700; color: #0f172a; line-height: 1.4;">
      ${escapeHtml(data.taskTitle)}
    </h2>

    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 16px 0; font-size: 14px;">
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="color: #64748b; padding: 4px 0; width: 120px;">Batas Waktu:</td>
          <td style="color: #0f172a; font-weight: 600; padding: 4px 0;">${escapeHtml(formattedDate)}</td>
        </tr>
        <tr>
          <td style="color: #64748b; padding: 4px 0;">Prioritas:</td>
          <td style="color: ${priority.color}; font-weight: 600; padding: 4px 0;">${escapeHtml(priority.label)}</td>
        </tr>
      </table>
    </div>

    <p style="color: #475569; font-size: 14px; margin-top: 20px;">
      Pastikan tugas Anda sudah diselesaikan dan statusnya diperbarui pada papan kerja sebelum batas waktu berakhir.
    </p>
  `

  const html = renderBaseLayout({
    title: `Pengingat Deadline: ${data.taskTitle}`,
    preheader: `${deadlineBadge.label} untuk tugas: ${data.taskTitle}`,
    contentHtml,
    ctaText: 'Buka Tugas di Board',
    ctaUrl: data.taskUrl,
  })

  const text = `[PENGINGAT DEADLINE MOASPACE]
Halo ${data.recipientName},

Tugas berikut memiliki ${deadlineBadge.label}:
- Judul: ${data.taskTitle}
- Batas Waktu: ${formattedDate}
- Prioritas: ${priority.label}
${data.divisionName ? `- Divisi: ${data.divisionName}\n` : ''}
Buka tugas di MoaSpace: ${data.taskUrl}`

  return { html, text }
}
