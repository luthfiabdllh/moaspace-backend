import { Module } from '@nestjs/common'
import { DivisionsController } from './divisions.controller.js'
import { DivisionsService } from './divisions.service.js'
import { ActivityLogsModule } from '../activity-logs/activity-logs.module.js'
import { TasksModule } from '../tasks/tasks.module.js'

@Module({
  imports: [ActivityLogsModule, TasksModule],
  controllers: [DivisionsController],
  providers: [DivisionsService],
  exports: [DivisionsService],
})
export class DivisionsModule {}
