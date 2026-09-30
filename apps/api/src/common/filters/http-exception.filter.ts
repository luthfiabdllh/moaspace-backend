import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common'
import type { Response } from 'express'

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name)

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp()
    const response = ctx.getResponse<Response>()

    let status = HttpStatus.INTERNAL_SERVER_ERROR
    let message = 'Internal server error'
    let details: unknown = null

    if (exception instanceof HttpException) {
      status = exception.getStatus()
      const res = exception.getResponse()

      if (typeof res === 'string') {
        message = res
      } else if (typeof res === 'object' && res !== null) {
        const resObj = res as Record<string, unknown>
        message = (resObj['message'] as string) || exception.message
        if (Array.isArray(resObj['message'])) {
          message = resObj['message'][0] ?? exception.message
          details = resObj['message']
        } else if (resObj['error']) {
          details = resObj['error']
        }
      }
    } else if (exception instanceof Error) {
      message = exception.message
      this.logger.error(exception.stack)
    }

    response.status(status).json({
      success: false,
      error: {
        code: status,
        message,
        details,
      },
    })
  }
}
