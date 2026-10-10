import { Module } from '@nestjs/common'
import { ActivityLogsModule } from '../activity-logs/activity-logs.module.js'
import { CalendarModule } from '../calendar/calendar.module.js'
import { UsersController } from './users.controller.js'
import { UsersService } from './users.service.js'

@Module({
  imports: [ActivityLogsModule, CalendarModule],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
