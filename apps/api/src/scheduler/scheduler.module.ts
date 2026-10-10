import { Module } from '@nestjs/common'
import { ScheduleModule } from '@nestjs/schedule'
import { DatabaseModule } from '../database/database.module.js'
import { MailModule } from '../mail/mail.module.js'
import { DeadlineReminderService } from './deadline-reminder.service.js'

@Module({
  imports: [ScheduleModule.forRoot(), DatabaseModule, MailModule],
  providers: [DeadlineReminderService],
  exports: [DeadlineReminderService],
})
export class SchedulerModule {}
