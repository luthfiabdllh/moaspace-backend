import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { APP_FILTER, APP_GUARD } from '@nestjs/core'
import { AppController } from './app.controller.js'
import { AppService } from './app.service.js'
import { AuthModule } from './auth/auth.module.js'
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard.js'
import { AllExceptionsFilter } from './common/filters/http-exception.filter.js'
import { DatabaseModule } from './database/database.module.js'
import { ActivityLogsModule } from './activity-logs/activity-logs.module.js'
import { DivisionsModule } from './divisions/divisions.module.js'
import { UsersModule } from './users/users.module.js'
import { ScheduleModule } from '@nestjs/schedule'
import { EpicsModule } from './epics/epics.module.js'
import { StoriesModule } from './stories/stories.module.js'
import { TasksModule } from './tasks/tasks.module.js'
import { CapacityModule } from './capacity/capacity.module.js'
import { RequestsModule } from './requests/requests.module.js'
import { UploadsModule } from './uploads/uploads.module.js'

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../.env', '../../.env'],
    }),
    ScheduleModule.forRoot(),
    DatabaseModule,
    AuthModule,
    DivisionsModule,
    UsersModule,
    ActivityLogsModule,
    EpicsModule,
    StoriesModule,
    TasksModule,
    CapacityModule,
    RequestsModule,
    UploadsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,
    },
  ],
})
export class AppModule {}
