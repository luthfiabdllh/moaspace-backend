import { escapeHtml, renderBaseLayout, formatDateWib } from './base-layout.js'

export type RequestEventType =
  | 'NEW_REQUEST'
  | 'WAITING_ORIGIN_APPROVAL'
  | 'NEED_INFO'
  | 'INFO_RESPONDED'
  | 'ACCEPTED'
  | 'REJECTED'
  | 'DELIVERED'
  | 'REVISION'
  | 'CONFIRMED'

export interface RequestEventMailData {
  recipientName: string
  eventType: RequestEventType
  requestTitle: string
  fromDivisionName: string
  toDivisionName: string
  requesterName: string
  deadline?: Date | string | null
  note?: string | null
  requestUrl: string
}

interface EventMeta {
  badgeLabel: string
  badgeBg: string
  badgeText: string
  headline: string
  description: string
  ctaText: string
}

const EVENT_METAS: Record<RequestEventType, EventMeta> = {
  NEW_REQUEST: {
    badgeLabel: '📥 PERMOHONAN BARU',
    badgeBg: '#e0e7ff',
    badgeText: '#4338ca',
    headline: 'Permohonan Baru Masuk ke Divisi Anda',
    description: 'Ada permohonan baru antar divisi yang diajukan dan membutuhkan peninjauan koordinator.',
    ctaText: 'Tinjau Permohonan',
  },
  WAITING_ORIGIN_APPROVAL: {
    badgeLabel: '⏳ PERLU APPROVAL ASAL',
    badgeBg: '#fef3c7',
    badgeText: '#b45309',
    headline: 'Permohonan Baru Memerlukan Persetujuan Koordinator',
    description: 'Anggota divisi Anda mengajukan permohonan ke divisi lain dan membutuhkan persetujuan Anda sebelum diteruskan.',
    ctaText: 'Beri Persetujuan',
  },
  NEED_INFO: {
    badgeLabel: '❓ MEMERLUKAN INFORMASI',
    badgeBg: '#fef3c7',
    badgeText: '#b45309',
    headline: 'Divisi Tujuan Meminta Informasi Tambahan',
    description: 'Permohonan Anda memerlukan rincian/klarifikasi lebih lanjut agar dapat diproses.',
    ctaText: 'Jawab Kebutuhan Info',
  },
  INFO_RESPONDED: {
    badgeLabel: '💬 INFO TELAH DIJAWAB',
    badgeBg: '#e0f2fe',
    badgeText: '#0369a1',
    headline: 'Pemohon Telah Menanggapi Kebutuhan Info',
    description: 'Klarifikasi yang Anda minta telah dijawab oleh pemohon dan siap ditinjau kembali.',
    ctaText: 'Periksa Tanggapan',
  },
  ACCEPTED: {
    badgeLabel: '✅ PERMOHONAN DITERIMA',
    badgeBg: '#dcfce7',
    badgeText: '#15803d',
    headline: 'Permohonan Anda Telah Diterima',
    description: 'Divisi tujuan telah menyetujui permohonan Anda dan mulai mengagendakan pengerjaan.',
    ctaText: 'Lihat Detail Permohonan',
  },
  REJECTED: {
    badgeLabel: '❌ PERMOHONAN DITOLAK',
    badgeBg: '#fee2e2',
    badgeText: '#b91c1c',
    headline: 'Permohonan Anda Ditolak',
    description: 'Divisi tujuan tidak dapat menerima permohonan ini dengan alasan di bawah ini.',
    ctaText: 'Lihat Detail Permohonan',
  },
  DELIVERED: {
    badgeLabel: '📦 HASIL TELAH DIKIRIM',
    badgeBg: '#f3e8ff',
    badgeText: '#7e22ce',
    headline: 'Hasil Pengerjaan Telah Dikirimkan',
    description: 'Divisi tujuan telah menyelesaikan permohonan Anda dan melampirkan hasil pekerjaan untuk Anda tinjau.',
    ctaText: 'Periksa Hasil & Konfirmasi',
  },
  REVISION: {
    badgeLabel: '🔄 PERMINTAAN REVISI',
    badgeBg: '#ffe4e6',
    badgeText: '#be123c',
    headline: 'Pemohon Mengajukan Revisi',
    description: 'Hasil pengerjaan permohonan membutuhkan penyesuaian/revisi sesuai catatan pemohon.',
    ctaText: 'Lihat Catatan Revisi',
  },
  CONFIRMED: {
    badgeLabel: '🎉 PERMOHONAN SELESAI',
    badgeBg: '#dcfce7',
    badgeText: '#15803d',
    headline: 'Permohonan Telah Dikonfirmasi Selesai',
    description: 'Pemohon telah menerima hasil pekerjaan dengan baik dan menutup permohonan ini.',
    ctaText: 'Lihat Riwayat Permohonan',
  },
}

export function renderRequestEventMail(data: RequestEventMailData): { html: string; text: string } {
  const meta = EVENT_METAS[data.eventType]

  let deadlineHtml = ''
  let deadlineText = ''
  if (data.deadline) {
    const formattedDate = formatDateWib(data.deadline)
    deadlineHtml = `
      <tr>
        <td style="color: #64748b; padding: 4px 0; width: 140px;">Batas Waktu:</td>
        <td style="color: #0f172a; font-weight: 600; padding: 4px 0;">${escapeHtml(formattedDate)}</td>
      </tr>
    `
    deadlineText = `- Batas Waktu: ${formattedDate}\n`
  }

  const contentHtml = `
    <p style="font-size: 15px; color: #334155; margin-top: 0;">Halo <strong>${escapeHtml(data.recipientName)}</strong>,</p>

    <div style="margin-bottom: 16px;">
      <span style="background-color: ${meta.badgeBg}; color: ${meta.badgeText}; padding: 4px 10px; border-radius: 6px; font-size: 12px; font-weight: 700; display: inline-block;">
        ${meta.badgeLabel}
      </span>
    </div>

    <h2 style="margin: 0 0 12px 0; font-size: 18px; font-weight: 700; color: #0f172a; line-height: 1.4;">
      ${escapeHtml(meta.headline)}
    </h2>

    <p style="font-size: 14px; color: #475569; margin: 0 0 16px 0; line-height: 1.5;">
      ${escapeHtml(meta.description)}
    </p>

    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 16px 0; font-size: 14px;">
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="color: #64748b; padding: 4px 0; width: 140px;">Judul Request:</td>
          <td style="color: #0f172a; font-weight: 600; padding: 4px 0;">${escapeHtml(data.requestTitle)}</td>
        </tr>
        <tr>
          <td style="color: #64748b; padding: 4px 0;">Dari Divisi:</td>
          <td style="color: #0f172a; font-weight: 500; padding: 4px 0;">${escapeHtml(data.fromDivisionName)}</td>
        </tr>
        <tr>
          <td style="color: #64748b; padding: 4px 0;">Kepada Divisi:</td>
          <td style="color: #0f172a; font-weight: 500; padding: 4px 0;">${escapeHtml(data.toDivisionName)}</td>
        </tr>
        <tr>
          <td style="color: #64748b; padding: 4px 0;">Pemohon:</td>
          <td style="color: #0f172a; font-weight: 500; padding: 4px 0;">${escapeHtml(data.requesterName)}</td>
        </tr>
        ${deadlineHtml}
      </table>
    </div>

    ${
      data.note
        ? `
      <div style="background-color: #fffbeb; border: 1px solid #fef3c7; border-left: 4px solid #f59e0b; border-radius: 6px; padding: 12px 16px; margin: 16px 0; font-size: 14px;">
        <div style="color: #92400e; font-size: 12px; font-weight: 700; text-transform: uppercase; margin-bottom: 4px;">Catatan:</div>
        <div style="color: #78350f; line-height: 1.5;">${escapeHtml(data.note)}</div>
      </div>
    `
        : ''
    }
  `

  const html = renderBaseLayout({
    title: `${meta.badgeLabel}: ${data.requestTitle}`,
    preheader: `${meta.headline} — ${data.requestTitle}`,
    contentHtml,
    ctaText: meta.ctaText,
    ctaUrl: data.requestUrl,
  })

  const text = `[${meta.badgeLabel}]
Halo ${data.recipientName},

${meta.headline}
${meta.description}

Rincian Request:
- Judul: ${data.requestTitle}
- Dari: ${data.fromDivisionName}
- Kepada: ${data.toDivisionName}
- Pemohon: ${data.requesterName}
${deadlineText}${data.note ? `- Catatan: ${data.note}\n` : ''}
Buka di MoaSpace: ${data.requestUrl}`

  return { html, text }
}
