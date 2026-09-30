import { Module } from '@nestjs/common'
import { ActivityLogsModule } from '../activity-logs/activity-logs.module.js'
import { UsersController } from './users.controller.js'
import { UsersService } from './users.service.js'

@Module({
  imports: [ActivityLogsModule],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
