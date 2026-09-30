import { Module } from '@nestjs/common'
import { RequestsService } from './requests.service.js'
import { RequestsController } from './requests.controller.js'
import { RequestTemplatesController } from './request-templates.controller.js'
import { ActivityLogsModule } from '../activity-logs/activity-logs.module.js'

@Module({
  imports: [ActivityLogsModule],
  controllers: [RequestsController, RequestTemplatesController],
  providers: [RequestsService],
  exports: [RequestsService],
})
export class RequestsModule {}
