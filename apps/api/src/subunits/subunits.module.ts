import { Module } from '@nestjs/common'
import { ActivityLogsModule } from '../activity-logs/activity-logs.module.js'
import { DatabaseModule } from '../database/database.module.js'
import { SubunitsController } from './subunits.controller.js'
import { SubunitsService } from './subunits.service.js'

@Module({
  imports: [DatabaseModule, ActivityLogsModule],
  controllers: [SubunitsController],
  providers: [SubunitsService],
  exports: [SubunitsService],
})
export class SubunitsModule {}
