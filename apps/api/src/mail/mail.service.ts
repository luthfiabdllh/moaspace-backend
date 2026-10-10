import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Resend } from 'resend'
import { renderAnnouncementMail, type AnnouncementMailData } from './templates/announcement-mail.js'
import { renderTaskDeadlineMail } from './templates/task-deadline-mail.js'
import { renderTaskAssignedMail } from './templates/task-assigned-mail.js'
import { renderRequestEventMail, type RequestEventMailData } from './templates/request-event-mail.js'
import { renderRequestDeadlineMail } from './templates/request-deadline-mail.js'
import { renderAccountActivationMail } from './templates/account-activation-mail.js'
import { renderPasswordResetMail } from './templates/password-reset-mail.js'

export interface SendMailOptions {
  to: string | string[]
  subject: string
  html: string
  text?: string
}

export interface RecipientInfo {
  email: string
  name: string
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name)
  private readonly resend: Resend | null = null
  private readonly fromAddress: string
  private readonly frontendUrl: string

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('RESEND_API_KEY')?.trim()
    this.fromAddress =
      this.configService.get<string>('EMAIL_FROM')?.trim() ||
      'MoaSpace <onboarding@resend.dev>'
    this.frontendUrl =
      this.configService.get<string>('FRONTEND_URL')?.trim() ||
      'http://localhost:3001'

    if (apiKey) {
      this.resend = new Resend(apiKey)
      this.logger.log('Resend client initialized successfully.')
    } else {
      this.logger.warn(
        'RESEND_API_KEY is not configured. Email notifications will be simulated in console logs.',
      )
    }
  }

  isConfigured(): boolean {
    return this.resend !== null
  }

  async sendMail(options: SendMailOptions): Promise<{ success: boolean; id?: string }> {
    const recipients = Array.isArray(options.to) ? options.to : [options.to]

    if (recipients.length === 0) {
      return { success: true }
    }

    if (!this.resend) {
      this.logger.log(
        `📧 [EMAIL SIMULATION] To: ${recipients.join(', ')} | Subject: "${options.subject}"`,
      )
      return { success: true, id: 'simulated-mail-id' }
    }

    try {
      const response = await this.resend.emails.send({
        from: this.fromAddress,
        to: recipients,
        subject: options.subject,
        html: options.html,
        text: options.text,
      })

      if (response.error) {
        this.logger.error(
          `Failed to send email via Resend to ${recipients.join(', ')}: ${response.error.message}`,
        )
        return { success: false }
      }

      this.logger.log(
        `Email sent successfully via Resend [ID: ${response.data?.id}] to ${recipients.join(', ')}`,
      )
      return { success: true, id: response.data?.id }
    } catch (err) {
      this.logger.error(`Unexpected error while sending email via Resend:`, err)
      return { success: false }
    }
  }

  // ─── 1. Announcement Notification ──────────────────────────────────────────
  async sendAnnouncement(
    recipients: RecipientInfo[],
    data: Omit<AnnouncementMailData, 'announcementUrl'> & { id: string },
  ): Promise<void> {
    if (recipients.length === 0) return

    const announcementUrl = `${this.frontendUrl}/announcements`
    const { html, text } = renderAnnouncementMail({
      ...data,
      announcementUrl,
    })

    const subject = `[Pengumuman MoaSpace] ${data.title}`
    const emails = recipients.map((r) => r.email).filter(Boolean)

    // Send in batches of 50 recipients if needed (Resend batch limit)
    const BATCH_SIZE = 50
    for (let i = 0; i < emails.length; i += BATCH_SIZE) {
      const chunk = emails.slice(i, i + BATCH_SIZE)
      await this.sendMail({
        to: chunk,
        subject,
        html,
        text,
      })
    }
  }

  // ─── 2. Task Deadline Reminder ─────────────────────────────────────────────
  async sendTaskDeadlineReminder(
    recipient: RecipientInfo,
    task: { id: string; title: string; divisionName?: string; priority?: string; dueDate: Date | string },
    isToday: boolean,
  ): Promise<void> {
    const taskUrl = `${this.frontendUrl}/board`
    const { html, text } = renderTaskDeadlineMail({
      recipientName: recipient.name,
      taskTitle: task.title,
      divisionName: task.divisionName,
      priority: task.priority,
      dueDate: task.dueDate,
      isToday,
      taskUrl,
    })

    const prefix = isToday ? '🚨 DEADLINE HARI INI' : '⚠️ DEADLINE BESOK'
    const subject = `[${prefix}] ${task.title}`

    await this.sendMail({
      to: recipient.email,
      subject,
      html,
      text,
    })
  }

  // ─── 3. Task Assigned Notification ─────────────────────────────────────────
  async sendTaskAssigned(
    recipient: RecipientInfo,
    task: { id: string; title: string; divisionName?: string; priority?: string; dueDate?: Date | string | null },
    assignerName: string,
  ): Promise<void> {
    const taskUrl = `${this.frontendUrl}/board`
    const { html, text } = renderTaskAssignedMail({
      recipientName: recipient.name,
      taskTitle: task.title,
      assignerName,
      divisionName: task.divisionName,
      priority: task.priority,
      dueDate: task.dueDate,
      taskUrl,
    })

    const subject = `[Penugasan Tugas] ${task.title}`

    await this.sendMail({
      to: recipient.email,
      subject,
      html,
      text,
    })
  }

  // ─── 4. Request Event Notification ─────────────────────────────────────────
  async sendRequestEvent(
    recipients: RecipientInfo[],
    data: Omit<RequestEventMailData, 'recipientName' | 'requestUrl'> & { id: string },
  ): Promise<void> {
    if (recipients.length === 0) return

    const requestUrl = `${this.frontendUrl}/requests/${data.id}`

    for (const recipient of recipients) {
      const { html, text } = renderRequestEventMail({
        ...data,
        recipientName: recipient.name,
        requestUrl,
      })

      const subject = `[Request Antar Divisi] ${data.requestTitle}`

      await this.sendMail({
        to: recipient.email,
        subject,
        html,
        text,
      })
    }
  }

  // ─── 5. Request Deadline Reminder ──────────────────────────────────────────
  async sendRequestDeadlineReminder(
    recipient: RecipientInfo,
    request: { id: string; title: string; toDivisionName: string; deadline: Date | string },
    isToday: boolean,
  ): Promise<void> {
    const requestUrl = `${this.frontendUrl}/requests/${request.id}`
    const { html, text } = renderRequestDeadlineMail({
      recipientName: recipient.name,
      requestTitle: request.title,
      toDivisionName: request.toDivisionName,
      deadline: request.deadline,
      isToday,
      requestUrl,
    })

    const prefix = isToday ? '🚨 TARGET HARI INI' : '⚠️ TARGET BESOK'
    const subject = `[${prefix}] Request: ${request.title}`

    await this.sendMail({
      to: recipient.email,
      subject,
      html,
      text,
    })
  }

  // ─── 6. Account Activation ─────────────────────────────────────────────────
  async sendAccountActivation(
    recipient: RecipientInfo,
    activationUrl: string,
  ): Promise<void> {
    const { html, text } = renderAccountActivationMail({
      userName: recipient.name,
      activationUrl,
    })

    const subject = 'Aktivasi Akun MoaSpace Anda'

    await this.sendMail({
      to: recipient.email,
      subject,
      html,
      text,
    })
  }

  // ─── 7. Password Reset ─────────────────────────────────────────────────────
  async sendPasswordReset(
    recipient: RecipientInfo,
    resetUrl: string,
  ): Promise<void> {
    const { html, text } = renderPasswordResetMail({
      userName: recipient.name,
      resetUrl,
    })

    const subject = 'Reset Kata Sandi Akun MoaSpace'

    await this.sendMail({
      to: recipient.email,
      subject,
      html,
      text,
    })
  }
}
