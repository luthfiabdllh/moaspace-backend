import { Injectable, UnauthorizedException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PassportStrategy } from '@nestjs/passport'
import { ExtractJwt, Strategy } from 'passport-jwt'

export interface JwtPayload {
  sub: string
  userId: string
  email: string
  name: string
  isSuperAdmin: boolean
  isKormanit?: boolean
  role?: string
  sessionId?: string
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(configService: ConfigService) {
    const secret =
      configService.get<string>('JWT_SECRET') ||
      'your-secret-key-change-me-in-production-min-32-chars'

    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        (request: { cookies?: Record<string, string> }) => {
          return request?.cookies?.['access_token'] ?? null
        },
      ]),
      ignoreExpiration: false,
      secretOrKey: secret,
    })
  }

  async validate(payload: JwtPayload) {
    if (!payload?.userId && !payload?.sub) {
      throw new UnauthorizedException('Token payload tidak valid')
    }

    const isSuperAdmin = payload.isSuperAdmin ?? false
    const isKormanit = payload.isKormanit ?? false

    return {
      userId: payload.userId ?? payload.sub,
      email: payload.email,
      name: payload.name,
      isSuperAdmin,
      isKormanit,
      role:
        payload.role ??
        (isSuperAdmin ? 'admin' : isKormanit ? 'kormanit' : 'user'),
      sessionId: payload.sessionId,
    }
  }
}
