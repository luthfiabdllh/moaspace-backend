import crypto from 'node:crypto'
import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { JwtService } from '@nestjs/jwt'
import {
  authTokensTable,
  divisionMembersTable,
  divisionsTable,
  sessionsTable,
  usersTable,
} from '@moaspace/database'
import bcrypt from 'bcrypt'
import { and, eq, gt, isNull } from 'drizzle-orm'
import { OAuth2Client } from 'google-auth-library'
import {
  DATABASE_CONNECTION,
  type Database,
} from '../database/database.provider.js'
import type { LoginDto } from './dto/login.dto.js'

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name)
  private readonly googleClient: OAuth2Client

  constructor(
    @Inject(DATABASE_CONNECTION) private readonly db: Database,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {
    const googleClientId = this.configService.get<string>('GOOGLE_CLIENT_ID')
    this.googleClient = new OAuth2Client(googleClientId)
  }

  // ─── 1. Login with Email and Password ──────────────────────────────────────
  async login(dto: LoginDto, userAgent?: string) {
    const user = await this.validateUser(dto.email, dto.password)
    return this.createSessionAndTokens(user, userAgent)
  }

  async validateUser(email: string, pass: string) {
    const [user] = await this.db
      .select()
      .from(usersTable)
      .where(eq(usersTable.email, email.toLowerCase().trim()))

    if (!user) {
      throw new UnauthorizedException('Email atau kata sandi salah')
    }

    if (user.status !== 'ACTIVE') {
      throw new UnauthorizedException('Akun Anda dinonaktifkan. Hubungi Super Admin.')
    }

    if (!user.passwordHash) {
      throw new UnauthorizedException(
        'Akun belum diaktivasi. Silakan periksa email aktivasi Anda untuk membuat kata sandi.',
      )
    }

    const isMatch = await bcrypt.compare(pass, user.passwordHash)
    if (!isMatch) {
      throw new UnauthorizedException('Email atau kata sandi salah')
    }

    return user
  }

  // ─── 2. Google OAuth / SSO ─────────────────────────────────────────────────
  async googleAuth(idToken: string, userAgent?: string) {
    let email: string | undefined
    let googleId: string | undefined

    try {
      const googleClientId = this.configService.get<string>('GOOGLE_CLIENT_ID')
      const ticket = await this.googleClient.verifyIdToken({
        idToken,
        audience: googleClientId,
      })
      const payload = ticket.getPayload()
      if (!payload?.email_verified) {
        throw new UnauthorizedException('Email Google belum terverifikasi')
      }
      email = payload.email
      googleId = payload.sub
    } catch (err) {
      // In development, allow mock Google authentication for local testing
      if (
        this.configService.get<string>('NODE_ENV') !== 'production' &&
        idToken.startsWith('mock-google-token:')
      ) {
        email = idToken.replace('mock-google-token:', '').trim()
        googleId = `google-${email}`
      } else {
        this.logger.warn(`Google token verification failed: ${err}`)
        throw new UnauthorizedException('Token Google tidak valid')
      }
    }

    if (!email) {
      throw new UnauthorizedException('Gagal mendapatkan email dari Google')
    }

    const [user] = await this.db
      .select()
      .from(usersTable)
      .where(eq(usersTable.email, email.toLowerCase().trim()))

    // PRD Workflow 1: No auto registration. Reject if not registered or inactive.
    if (!user) {
      throw new UnauthorizedException(
        'Email Google ini belum didaftarkan oleh Super Admin. Pendaftaran mandiri tidak diizinkan.',
      )
    }

    if (user.status !== 'ACTIVE') {
      throw new UnauthorizedException('Akun Anda dinonaktifkan. Hubungi Super Admin.')
    }

    if (!user.googleId && googleId) {
      await this.db
        .update(usersTable)
        .set({ googleId })
        .where(eq(usersTable.id, user.id))
    }

    return this.createSessionAndTokens(user, userAgent)
  }

  // ─── 3. Refresh Token Rotation ─────────────────────────────────────────────
  async refresh(refreshToken: string, userAgent?: string) {
    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token tidak ditemukan')
    }

    const hashedIncoming = this.hashToken(refreshToken)

    const [session] = await this.db
      .select()
      .from(sessionsTable)
      .where(
        and(
          eq(sessionsTable.refreshTokenHash, hashedIncoming),
          isNull(sessionsTable.revokedAt),
          gt(sessionsTable.expiresAt, new Date()),
        ),
      )

    if (!session) {
      throw new UnauthorizedException('Refresh token tidak valid atau telah kedaluwarsa')
    }

    const [user] = await this.db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, session.userId))

    if (!user || user.status !== 'ACTIVE') {
      // Revoke this session
      await this.db
        .update(sessionsTable)
        .set({ revokedAt: new Date() })
        .where(eq(sessionsTable.id, session.id))
      throw new UnauthorizedException('Pengguna tidak aktif')
    }

    // Revoke old session (Rotation)
    await this.db
      .update(sessionsTable)
      .set({ revokedAt: new Date() })
      .where(eq(sessionsTable.id, session.id))

    // Create new session & tokens
    return this.createSessionAndTokens(user, userAgent || session.userAgent || undefined)
  }

  // ─── 4. Logout (Session Revocation) ────────────────────────────────────────
  async logout(userId: string, refreshToken?: string) {
    if (refreshToken) {
      const hashed = this.hashToken(refreshToken)
      await this.db
        .update(sessionsTable)
        .set({ revokedAt: new Date() })
        .where(and(eq(sessionsTable.userId, userId), eq(sessionsTable.refreshTokenHash, hashed)))
    } else {
      // Revoke all active sessions for this user
      await this.db
        .update(sessionsTable)
        .set({ revokedAt: new Date() })
        .where(and(eq(sessionsTable.userId, userId), isNull(sessionsTable.revokedAt)))
    }

    return { success: true, message: 'Berhasil logout' }
  }

  // ─── 5. Get Current User Profile (/auth/me) ────────────────────────────────
  async getMe(userId: string) {
    const [user] = await this.db
      .select({
        id: usersTable.id,
        name: usersTable.name,
        email: usersTable.email,
        isSuperAdmin: usersTable.isSuperAdmin,
        status: usersTable.status,
        createdAt: usersTable.createdAt,
      })
      .from(usersTable)
      .where(eq(usersTable.id, userId))

    if (!user) {
      throw new UnauthorizedException('Pengguna tidak ditemukan')
    }

    // Fetch user division memberships
    const memberships = await this.db
      .select({
        divisionId: divisionMembersTable.divisionId,
        role: divisionMembersTable.role,
        divisionName: divisionsTable.name,
        divisionSlug: divisionsTable.slug,
      })
      .from(divisionMembersTable)
      .innerJoin(divisionsTable, eq(divisionMembersTable.divisionId, divisionsTable.id))
      .where(eq(divisionMembersTable.userId, userId))

    return {
      ...user,
      role: user.isSuperAdmin ? 'admin' : memberships[0]?.role?.toLowerCase() || 'user',
      divisions: memberships,
    }
  }

  // ─── 6. Account Activation ─────────────────────────────────────────────────
  async activate(token: string, newPassword: string, userAgent?: string) {
    const tokenHash = this.hashToken(token)

    const [record] = await this.db
      .select()
      .from(authTokensTable)
      .where(
        and(
          eq(authTokensTable.tokenHash, tokenHash),
          eq(authTokensTable.type, 'ACTIVATION'),
          isNull(authTokensTable.usedAt),
          gt(authTokensTable.expiresAt, new Date()),
        ),
      )

    if (!record) {
      throw new BadRequestException('Token aktivasi tidak valid atau telah kedaluwarsa')
    }

    const passwordHash = await bcrypt.hash(newPassword, 10)

    // Mark token as used and update user password in transaction
    await this.db.transaction(async (tx) => {
      await tx
        .update(usersTable)
        .set({ passwordHash, status: 'ACTIVE' })
        .where(eq(usersTable.id, record.userId))

      await tx
        .update(authTokensTable)
        .set({ usedAt: new Date() })
        .where(eq(authTokensTable.id, record.id))
    })

    const [user] = await this.db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, record.userId))

    if (!user) {
      throw new BadRequestException('Pengguna tidak ditemukan')
    }

    return this.createSessionAndTokens(user, userAgent)
  }

  // ─── 7. Forgot Password ────────────────────────────────────────────────────
  async forgotPassword(email: string) {
    const normalized = email.toLowerCase().trim()
    const [user] = await this.db
      .select()
      .from(usersTable)
      .where(eq(usersTable.email, normalized))

    if (user && user.status === 'ACTIVE') {
      const rawToken = crypto.randomBytes(32).toString('hex')
      const tokenHash = this.hashToken(rawToken)
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000) // 1 jam

      await this.db.insert(authTokensTable).values({
        id: crypto.randomUUID(),
        userId: user.id,
        type: 'RESET_PASSWORD',
        tokenHash,
        expiresAt,
      })

      const resetUrl = `http://localhost:3001/reset-password?token=${rawToken}`
      this.logger.log(`📧 [EMAIL SIMULATION] Link Reset Password untuk ${normalized}: ${resetUrl}`)
    }

    // Always return identical response to prevent user enumeration
    return {
      success: true,
      message:
        'Jika email Anda terdaftar dan aktif, link untuk reset kata sandi telah dikirimkan ke email Anda.',
    }
  }

  // ─── 8. Reset Password with Token ──────────────────────────────────────────
  async resetPassword(token: string, newPassword: string) {
    const tokenHash = this.hashToken(token)

    const [record] = await this.db
      .select()
      .from(authTokensTable)
      .where(
        and(
          eq(authTokensTable.tokenHash, tokenHash),
          eq(authTokensTable.type, 'RESET_PASSWORD'),
          isNull(authTokensTable.usedAt),
          gt(authTokensTable.expiresAt, new Date()),
        ),
      )

    if (!record) {
      throw new BadRequestException('Token reset kata sandi tidak valid atau telah kedaluwarsa')
    }

    const passwordHash = await bcrypt.hash(newPassword, 10)

    // Update password, mark token used, and revoke all existing sessions
    await this.db.transaction(async (tx) => {
      await tx
        .update(usersTable)
        .set({ passwordHash })
        .where(eq(usersTable.id, record.userId))

      await tx
        .update(authTokensTable)
        .set({ usedAt: new Date() })
        .where(eq(authTokensTable.id, record.id))

      // Revoke all sessions for security
      await tx
        .update(sessionsTable)
        .set({ revokedAt: new Date() })
        .where(and(eq(sessionsTable.userId, record.userId), isNull(sessionsTable.revokedAt)))
    })

    return {
      success: true,
      message: 'Kata sandi berhasil diperbarui. Silakan masuk menggunakan kata sandi baru Anda.',
    }
  }

  // ─── Helper: Create Session & Tokens ───────────────────────────────────────
  private async createSessionAndTokens(
    user: {
      id: string
      email: string
      name: string
      isSuperAdmin: boolean
      status: string
    },
    userAgent?: string,
  ) {
    const sessionId = crypto.randomUUID()
    const rawRefreshToken = crypto.randomBytes(40).toString('hex')
    const refreshTokenHash = this.hashToken(rawRefreshToken)

    const accessTokenTtl = Number(this.configService.get<number>('ACCESS_TOKEN_TTL', 900)) // 15 menit
    const refreshTokenTtl = Number(this.configService.get<number>('REFRESH_TOKEN_TTL', 604800)) // 7 hari

    const payload = {
      sub: user.id,
      userId: user.id,
      email: user.email,
      name: user.name,
      isSuperAdmin: user.isSuperAdmin,
      role: user.isSuperAdmin ? 'admin' : 'user',
      sessionId,
    }

    const accessToken = this.jwtService.sign(payload, {
      expiresIn: `${accessTokenTtl}s`,
    })

    const expiresAt = new Date(Date.now() + refreshTokenTtl * 1000)

    await this.db.insert(sessionsTable).values({
      id: sessionId,
      userId: user.id,
      refreshTokenHash,
      expiresAt,
      userAgent: userAgent || 'Unknown',
    })

    return {
      accessToken,
      refreshToken: rawRefreshToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        isSuperAdmin: user.isSuperAdmin,
        status: user.status,
      },
    }
  }

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex')
  }
}
