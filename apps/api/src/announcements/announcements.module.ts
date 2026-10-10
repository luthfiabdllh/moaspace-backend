import { Module } from '@nestjs/common'
import { AnnouncementsController } from './announcements.controller.js'
import { AnnouncementsService } from './announcements.service.js'
import { ActivityLogsModule } from '../activity-logs/activity-logs.module.js'
import { CalendarModule } from '../calendar/calendar.module.js'

@Module({
  imports: [ActivityLogsModule, CalendarModule],
  controllers: [AnnouncementsController],
  providers: [AnnouncementsService],
  exports: [AnnouncementsService],
})
export class AnnouncementsModule {}
