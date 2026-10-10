import { Module } from '@nestjs/common'
import { ActivityLogsModule } from '../activity-logs/activity-logs.module.js'
import { ProgramsController } from './programs.controller.js'
import { ProgramsService } from './programs.service.js'

@Module({
  imports: [ActivityLogsModule],
  controllers: [ProgramsController],
  providers: [ProgramsService],
  exports: [ProgramsService],
})
export class ProgramsModule {}
