import { Module } from '@nestjs/common'
import { StoriesController } from './stories.controller.js'
import { StoriesService } from './stories.service.js'
import { ActivityLogsModule } from '../activity-logs/activity-logs.module.js'

@Module({
  imports: [ActivityLogsModule],
  controllers: [StoriesController],
  providers: [StoriesService],
  exports: [StoriesService],
})
export class StoriesModule {}
