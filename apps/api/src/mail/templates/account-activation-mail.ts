import { escapeHtml, renderBaseLayout } from './base-layout.js'

export interface AccountActivationMailData {
  userName: string
  activationUrl: string
}

export function renderAccountActivationMail(data: AccountActivationMailData): { html: string; text: string } {
  const contentHtml = `
    <h2 style="margin: 0 0 16px 0; font-size: 20px; font-weight: 700; color: #0f172a;">
      Selamat Datang di MoaSpace!
    </h2>

    <p style="font-size: 15px; color: #334155; margin: 0 0 16px 0; line-height: 1.6;">
      Halo <strong>${escapeHtml(data.userName)}</strong>, akun Anda telah didaftarkan ke platform kolaborasi tim MoaSpace.
    </p>

    <p style="font-size: 15px; color: #334155; margin: 0 0 20px 0; line-height: 1.6;">
      Untuk mulai menggunakan platform, silakan buat kata sandi akun Anda melalui tombol di bawah ini:
    </p>

    <div style="background-color: #f1f5f9; border-radius: 8px; padding: 12px 16px; margin: 20px 0; font-size: 13px; color: #475569;">
      🔒 Tautan aktivasi ini bersifat rahasia dan hanya berlaku selama 24 jam.
    </div>
  `

  const html = renderBaseLayout({
    title: 'Aktivasi Akun MoaSpace',
    preheader: `Halo ${data.userName}, aktivasi akun MoaSpace Anda sekarang`,
    contentHtml,
    ctaText: 'Aktivasi Akun Saya',
    ctaUrl: data.activationUrl,
  })

  const text = `[AKTIVASI AKUN MOASPACE]
Halo ${data.userName},

Selamat datang di platform kolaborasi MoaSpace!
Akun Anda telah dibuat. Silakan buka tautan berikut untuk membuat kata sandi dan mengaktifkan akun Anda:

${data.activationUrl}

Tautan ini berlaku selama 24 jam.`

  return { html, text }
}
