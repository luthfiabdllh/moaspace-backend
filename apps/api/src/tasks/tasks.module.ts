import { Module } from '@nestjs/common'
import { TasksController } from './tasks.controller.js'
import { MeTasksController } from './me-tasks.controller.js'
import { TasksService } from './tasks.service.js'
import { TaskTransitionService } from './task-transition.service.js'
import { ActivityLogsModule } from '../activity-logs/activity-logs.module.js'
import { CapacityModule } from '../capacity/capacity.module.js'

@Module({
  imports: [ActivityLogsModule, CapacityModule],
  controllers: [TasksController, MeTasksController],
  providers: [TasksService, TaskTransitionService],
  exports: [TasksService, TaskTransitionService],
})
export class TasksModule {}
