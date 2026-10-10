import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MailService } from './mail.service.js'

describe('MailService', () => {
  let configService: any

  beforeEach(() => {
    configService = {
      get: vi.fn((key: string, defaultValue?: any) => {
        if (key === 'RESEND_API_KEY') return ''
        if (key === 'EMAIL_FROM') return 'MoaSpace <no-reply@moaspace.my.id>'
        if (key === 'FRONTEND_URL') return 'http://localhost:3000'
        return defaultValue
      }),
    }
  })

  describe('When RESEND_API_KEY is empty (mock mode)', () => {
    it('does not crash and logs simulation instead of failing', async () => {
      const service = new MailService(configService)
      expect(service.isConfigured()).toBe(false)

      await expect(
        service.sendAccountActivation(
          { email: 'user@example.com', name: 'User Test' },
          'http://localhost:3000/activate?token=abc',
        ),
      ).resolves.not.toThrow()
    })
  })

  describe('Template and mail sending methods', () => {
    it('sends announcement notification to all recipients', async () => {
      const service = new MailService(configService)
      const sendMailSpy = vi.spyOn(service as any, 'sendMail').mockResolvedValue(undefined)

      await service.sendAnnouncement(
        [
          { email: 'member1@example.com', name: 'Member 1' },
          { email: 'member2@example.com', name: 'Member 2' },
        ],
        {
          id: 'ann-1',
          title: 'Rapat Divisi',
          authorName: 'Admin',
          category: 'MEETING',
          targetType: 'ALL',
        },
      )

      expect(sendMailSpy).toHaveBeenCalledTimes(1)
      expect(sendMailSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          to: ['member1@example.com', 'member2@example.com'],
          subject: '[Pengumuman MoaSpace] Rapat Divisi',
        }),
      )
    })

    it('sends task deadline reminder with H-1 vs Hari H subject prefix', async () => {
      const service = new MailService(configService)
      const sendMailSpy = vi.spyOn(service as any, 'sendMail').mockResolvedValue(undefined)

      // Hari H
      await service.sendTaskDeadlineReminder(
        { email: 'assignee@example.com', name: 'Assignee' },
        { id: 'task-1', title: 'Desain Banner', dueDate: new Date().toISOString() },
        true,
      )
      expect(sendMailSpy).toHaveBeenLastCalledWith(
        expect.objectContaining({
          subject: '[🚨 DEADLINE HARI INI] Desain Banner',
        }),
      )

      // H-1
      await service.sendTaskDeadlineReminder(
        { email: 'assignee@example.com', name: 'Assignee' },
        { id: 'task-1', title: 'Desain Banner', dueDate: new Date().toISOString() },
        false,
      )
      expect(sendMailSpy).toHaveBeenLastCalledWith(
        expect.objectContaining({
          subject: '[⚠️ DEADLINE BESOK] Desain Banner',
        }),
      )
    })

    it('sends task assignment notification', async () => {
      const service = new MailService(configService)
      const sendMailSpy = vi.spyOn(service as any, 'sendMail').mockResolvedValue(undefined)

      await service.sendTaskAssigned(
        { email: 'assignee@example.com', name: 'Assignee' },
        { id: 'task-2', title: 'Buat Artikel', priority: 'HIGH' },
        'Koordinator',
      )

      expect(sendMailSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'assignee@example.com',
          subject: '[Penugasan Tugas] Buat Artikel',
        }),
      )
    })

    it('sends request event notification to recipients', async () => {
      const service = new MailService(configService)
      const sendMailSpy = vi.spyOn(service as any, 'sendMail').mockResolvedValue(undefined)

      await service.sendRequestEvent(
        [{ email: 'target@example.com', name: 'Target Coordinator' }],
        {
          id: 'req-1',
          eventType: 'NEW_REQUEST',
          requestTitle: 'Permohonan Video Dokumentasi',
          fromDivisionName: 'Acara',
          toDivisionName: 'Media Kreatif',
          requesterName: 'Budi',
        },
      )

      expect(sendMailSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'target@example.com',
          subject: '[Request Antar Divisi] Permohonan Video Dokumentasi',
        }),
      )
    })

    it('sends request deadline reminder', async () => {
      const service = new MailService(configService)
      const sendMailSpy = vi.spyOn(service as any, 'sendMail').mockResolvedValue(undefined)

      await service.sendRequestDeadlineReminder(
        { email: 'coord@example.com', name: 'Koordinator' },
        {
          id: 'req-1',
          title: 'Request Spanduk',
          toDivisionName: 'Media Kreatif',
          deadline: new Date().toISOString(),
        },
        true,
      )

      expect(sendMailSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: '[🚨 TARGET HARI INI] Request: Request Spanduk',
        }),
      )
    })

    it('sends password reset email', async () => {
      const service = new MailService(configService)
      const sendMailSpy = vi.spyOn(service as any, 'sendMail').mockResolvedValue(undefined)

      await service.sendPasswordReset(
        { email: 'user@example.com', name: 'User' },
        'http://localhost:3000/reset-password?token=xyz',
      )

      expect(sendMailSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'user@example.com',
          subject: 'Reset Kata Sandi Akun MoaSpace',
        }),
      )
    })
  })
})
