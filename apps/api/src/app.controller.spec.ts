import { describe, expect, it, beforeEach } from 'vitest'
import { Test, type TestingModule } from '@nestjs/testing'
import { AppController } from './app.controller.js'
import { AppService } from './app.service.js'

describe('AppController', () => {
  let appController: AppController

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService],
    }).compile()

    appController = module.get<AppController>(AppController)
  })

  it('should return API information', () => {
    const info = appController.getInfo()
    expect(info.name).toBe('MoaSpace API')
    expect(info.status).toBe('ok')
  })

  it('should return health status', () => {
    const health = appController.getHealth()
    expect(health.status).toBe('ok')
    expect(health.uptime).toBeTypeOf('number')
  })
})
