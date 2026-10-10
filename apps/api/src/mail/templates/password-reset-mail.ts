import { escapeHtml, renderBaseLayout } from './base-layout.js'

export interface PasswordResetMailData {
  userName: string
  resetUrl: string
}

export function renderPasswordResetMail(data: PasswordResetMailData): { html: string; text: string } {
  const contentHtml = `
    <h2 style="margin: 0 0 16px 0; font-size: 20px; font-weight: 700; color: #0f172a;">
      Permintaan Reset Kata Sandi
    </h2>

    <p style="font-size: 15px; color: #334155; margin: 0 0 16px 0; line-height: 1.6;">
      Halo <strong>${escapeHtml(data.userName)}</strong>, kami menerima permintaan untuk mengatur ulang kata sandi akun MoaSpace Anda.
    </p>

    <p style="font-size: 15px; color: #334155; margin: 0 0 20px 0; line-height: 1.6;">
      Klik tombol di bawah ini untuk membuat kata sandi baru:
    </p>

    <div style="background-color: #fffbeb; border: 1px solid #fef3c7; border-left: 4px solid #f59e0b; border-radius: 6px; padding: 12px 16px; margin: 20px 0; font-size: 13px; color: #78350f;">
      ⚠️ Jika Anda tidak merasa melakukan permintaan ini, abaikan email ini. Kata sandi akun Anda tetap aman. Tautan ini berlaku selama 1 jam.
    </div>
  `

  const html = renderBaseLayout({
    title: 'Reset Kata Sandi MoaSpace',
    preheader: `Permintaan reset kata sandi akun MoaSpace untuk ${data.userName}`,
    contentHtml,
    ctaText: 'Reset Kata Sandi',
    ctaUrl: data.resetUrl,
  })

  const text = `[RESET KATA SANDI MOASPACE]
Halo ${data.userName},

Kami menerima permintaan reset kata sandi akun MoaSpace Anda.
Buka tautan berikut untuk membuat kata sandi baru:

${data.resetUrl}

Tautan ini berlaku selama 1 jam. Abaikan jika Anda tidak meminta reset kata sandi.`

  return { html, text }
}
