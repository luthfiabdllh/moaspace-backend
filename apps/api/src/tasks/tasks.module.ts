import { Module } from '@nestjs/common'
import { TasksController } from './tasks.controller.js'
import { TasksService } from './tasks.service.js'
import { ActivityLogsModule } from '../activity-logs/activity-logs.module.js'

@Module({
  imports: [ActivityLogsModule],
  controllers: [TasksController],
  providers: [TasksService],
  exports: [TasksService],
})
export class TasksModule {}
