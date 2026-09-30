import { Module } from '@nestjs/common'
import { DivisionsController } from './divisions.controller.js'
import { DivisionsService } from './divisions.service.js'

@Module({
  controllers: [DivisionsController],
  providers: [DivisionsService],
  exports: [DivisionsService],
})
export class DivisionsModule {}
