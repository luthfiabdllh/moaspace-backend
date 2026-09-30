import { createParamDecorator, type ExecutionContext } from '@nestjs/common'

export interface RequestUser {
  userId: string
  email: string
  isSuperAdmin: boolean
  sessionId?: string
}

export const CurrentUser = createParamDecorator(
  (data: keyof RequestUser | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest()
    const user = request.user as RequestUser | undefined
    return data && user ? user[data] : user
  },
)
