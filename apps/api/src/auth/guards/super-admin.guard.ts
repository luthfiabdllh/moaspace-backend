import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common'
import type { RequestUser } from '../../common/decorators/current-user.decorator.js'

@Injectable()
export class SuperAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = ctxUser(context)

    if (!request?.isSuperAdmin && !request?.isKormanit) {
      throw new ForbiddenException(
        'Akses khusus Super Admin atau Koordinator Mahasiswa Unit',
      )
    }

    return true
  }
}

function ctxUser(context: ExecutionContext): RequestUser | undefined {
  const request = context.switchToHttp().getRequest()
  return request.user as RequestUser | undefined
}
