export interface BaseLayoutOptions {
  title: string
  preheader?: string
  contentHtml: string
  ctaText?: string
  ctaUrl?: string
}

export function renderBaseLayout(options: BaseLayoutOptions): string {
  const { title, preheader, contentHtml, ctaText, ctaUrl } = options

  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background-color: #f4f4f5;
      color: #18181b;
      -webkit-font-smoothing: antialiased;
    }
    .wrapper {
      width: 100%;
      table-layout: fixed;
      background-color: #f4f4f5;
      padding: 32px 16px;
    }
    .container {
      max-width: 580px;
      margin: 0 auto;
      background-color: #ffffff;
      border-radius: 12px;
      border: 1px solid #e4e4e7;
      overflow: hidden;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
    }
    .header {
      background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
      padding: 24px 32px;
      text-align: left;
    }
    .header-logo {
      color: #ffffff;
      font-size: 20px;
      font-weight: 700;
      letter-spacing: -0.5px;
      text-decoration: none;
      display: inline-block;
    }
    .header-badge {
      display: inline-block;
      margin-left: 8px;
      padding: 2px 8px;
      background-color: rgba(255, 255, 255, 0.2);
      color: #ffffff;
      border-radius: 9999px;
      font-size: 11px;
      font-weight: 600;
      vertical-align: middle;
    }
    .content {
      padding: 32px;
      line-height: 1.6;
      font-size: 15px;
      color: #27272a;
    }
    .cta-container {
      margin: 28px 0 12px 0;
      text-align: center;
    }
    .cta-button {
      display: inline-block;
      background-color: #4f46e5;
      color: #ffffff !important;
      padding: 12px 28px;
      font-size: 14px;
      font-weight: 600;
      text-decoration: none;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(79, 70, 229, 0.2);
    }
    .footer {
      padding: 20px 32px 28px 32px;
      border-top: 1px solid #f4f4f5;
      font-size: 12px;
      color: #71717a;
      text-align: center;
      line-height: 1.5;
    }
    .info-box {
      background-color: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 16px;
      margin: 20px 0;
    }
    .badge {
      display: inline-block;
      padding: 3px 8px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 600;
    }
  </style>
</head>
<body>
  ${preheader ? `<div style="display:none;font-size:1px;color:#333;line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;">${escapeHtml(preheader)}</div>` : ''}
  <table class="wrapper" cellpadding="0" cellspacing="0" role="presentation">
    <tr>
      <td align="center">
        <div class="container">
          <div class="header">
            <span class="header-logo">MoaSpace</span>
            <span class="header-badge">Tim KKN</span>
          </div>
          <div class="content">
            ${contentHtml}
            ${
              ctaText && ctaUrl
                ? `<div class="cta-container">
                    <a href="${escapeHtml(ctaUrl)}" class="cta-button" target="_blank">${escapeHtml(ctaText)}</a>
                   </div>`
                : ''
            }
          </div>
          <div class="footer">
            Email ini dikirim secara otomatis oleh platform MoaSpace.<br>
            © ${new Date().getFullYear()} MoaSpace - Tim KKN Moa Bercerita.
          </div>
        </div>
      </td>
    </tr>
  </table>
</body>
</html>`
}

export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

export function formatDateTimeWib(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return `${d.toLocaleString('id-ID', {
    timeZone: 'Asia/Jakarta',
    dateStyle: 'full',
    timeStyle: 'short',
  })} WIB`
}

export function formatDateWib(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString('id-ID', {
    timeZone: 'Asia/Jakarta',
    dateStyle: 'full',
  })
}

