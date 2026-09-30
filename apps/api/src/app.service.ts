import { Injectable } from '@nestjs/common'

@Injectable()
export class AppService {
  getInfo() {
    return {
      name: 'MoaSpace API',
      version: '1.0.0',
      status: 'ok',
      timestamp: new Date().toISOString(),
    }
  }

  getHealth() {
    return {
      status: 'ok',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    }
  }
}
