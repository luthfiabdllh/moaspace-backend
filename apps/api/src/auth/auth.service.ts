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
import { ActivityLogsService } from '../activity-logs/activity-logs.service.js'
import {
  DATABASE_CONNECTION,
  type Database,
} from '../database/database.provider.js'
import { MailService } from '../mail/mail.service.js'
import type { ChangePasswordDto } from './dto/change-password.dto.js'
import type { LoginDto } from './dto/login.dto.js'
import type { UpdateProfileDto } from './dto/update-profile.dto.js'

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name)
  private readonly googleClient: OAuth2Client

  constructor(
    @Inject(DATABASE_CONNECTION) private readonly db: Database,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly activityLogsService: ActivityLogsService,
    private readonly mailService: MailService,
  ) {
    const googleClientId = this.configService.get<string>('GOOGLE_CLIENT_ID')
    const googleClientSecret = this.configService.get<string>('GOOGLE_CLIENT_SECRET')
    const googleCallbackUrl = this.configService.get<string>(
      'GOOGLE_CALLBACK_URL',
      'http://localhost:3001/api/auth/google/callback',
    )
    this.googleClient = new OAuth2Client(
      googleClientId,
      googleClientSecret,
      googleCallbackUrl,
    )
  }

  // ─── 1. Login with Email and Password ──────────────────────────────────────
  async login(dto: LoginDto, userAgent?: string) {
    const user = await this.validateUser(dto.email, dto.password)
    return this.createSessionAndTokens(user, userAgent, dto.rememberMe ?? false)
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

  // ─── 2. Google OAuth 2.0 (SSO) ─────────────────────────────────────────────

  /**
   * Generates Google OAuth 2.0 authorization URL
   */
  getGoogleAuthUrl(redirectUri?: string): string {
    const callbackUrl =
      redirectUri ||
      this.configService.get<string>(
        'GOOGLE_CALLBACK_URL',
        'http://localhost:3001/api/auth/google/callback',
      )

    return this.googleClient.generateAuthUrl({
      access_type: 'offline',
      scope: ['openid', 'email', 'profile'],
      prompt: 'select_account',
      redirect_uri: callbackUrl,
    })
  }

  /**
   * Exchanges Google OAuth 2.0 authorization code for session & tokens
   * Enforces closed system: rejects unregistered emails.
   */
  async handleGoogleCallback(code: string, redirectUri?: string, userAgent?: string) {
    const googleClientId = this.configService.get<string>('GOOGLE_CLIENT_ID')
    const callbackUrl =
      redirectUri ||
      this.configService.get<string>(
        'GOOGLE_CALLBACK_URL',
        'http://localhost:3001/api/auth/google/callback',
      )

    let email: string | undefined
    let googleId: string | undefined

    try {
      if (
        this.configService.get<string>('NODE_ENV') !== 'production' &&
        code.startsWith('mock-google-code:')
      ) {
        email = code.replace('mock-google-code:', '').trim()
        googleId = `google-${email}`
      } else {
        const { tokens } = await this.googleClient.getToken({
          code,
          redirect_uri: callbackUrl,
        })

        if (tokens.id_token) {
          const ticket = await this.googleClient.verifyIdToken({
            idToken: tokens.id_token,
            audience: googleClientId,
          })
          const payload = ticket.getPayload()
          if (!payload?.email_verified) {
            throw new UnauthorizedException('Email Google belum terverifikasi')
          }
          email = payload.email
          googleId = payload.sub
        } else if (tokens.access_token) {
          const userinfoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
            headers: { Authorization: `Bearer ${tokens.access_token}` },
          })
          if (!userinfoRes.ok) {
            throw new UnauthorizedException('Gagal mengambil data profil dari Google')
          }
          const profile = (await userinfoRes.json()) as {
            email?: string
            email_verified?: boolean
            sub?: string
            name?: string
          }
          if (!profile.email_verified) {
            throw new UnauthorizedException('Email Google belum terverifikasi')
          }
          email = profile.email
          googleId = profile.sub
        }
      }
    } catch (err: any) {
      if (err instanceof UnauthorizedException) throw err
      this.logger.warn(`Google code exchange failed: ${err?.message || err}`)
      throw new UnauthorizedException(
        'Gagal memproses autentikasi Google. Kode otorisasi tidak valid.',
      )
    }

    if (!email) {
      throw new UnauthorizedException('Gagal mendapatkan email dari Google')
    }

    return this.processGoogleUser(email, googleId, userAgent)
  }

  /**
   * Google ID Token verification (for Google One Tap / popup client SDK)
   * Enforces closed system: rejects unregistered emails.
   */
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

    return this.processGoogleUser(email, googleId, userAgent)
  }

  /**
   * Helper: Validates Google user against database (CLOSED SYSTEM)
   * If email is not in usersTable -> rejected with 401
   * If status is not ACTIVE -> rejected with 401
   */
  private async processGoogleUser(email: string, googleId?: string, userAgent?: string) {
    const [user] = await this.db
      .select()
      .from(usersTable)
      .where(eq(usersTable.email, email.toLowerCase().trim()))

    // Closed System Check (PRD Workflow 1):
    // Registration must be done by Super Admin first. Public/auto-registration is rejected.
    if (!user) {
      throw new UnauthorizedException(
        `Email Google (${email}) belum terdaftar. Sistem ini bersifat tertutup (closed system). Silakan hubungi Super Admin KKN untuk mendaftarkan akun Anda terlebih dahulu.`,
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

    return this.createSessionAndTokens(user, userAgent, true)
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

    // Preserve Remember Me duration on rotation (if previous session > 7 days)
    const sessionDurationMs = session.expiresAt.getTime() - session.createdAt.getTime()
    const isRemembered = sessionDurationMs > 7 * 24 * 60 * 60 * 1000

    // Create new session & tokens
    return this.createSessionAndTokens(
      user,
      userAgent || session.userAgent || undefined,
      isRemembered,
    )
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
        isKormanit: usersTable.isKormanit,
        status: usersTable.status,
        passwordHash: usersTable.passwordHash,
        googleId: usersTable.googleId,
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
      id: user.id,
      name: user.name,
      email: user.email,
      isSuperAdmin: user.isSuperAdmin,
      isKormanit: user.isKormanit,
      status: user.status,
      hasPassword: user.passwordHash !== null,
      googleLinked: user.googleId !== null,
      createdAt: user.createdAt,
      role: user.isSuperAdmin
        ? 'admin'
        : user.isKormanit
          ? 'kormanit'
          : memberships[0]?.role?.toLowerCase() || 'user',
      divisions: memberships,
    }
  }

  // ─── Update Profile Name (/auth/profile) ──────────────────────────────────
  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const newName = dto.name.trim()
    const [user] = await this.db
      .select({
        id: usersTable.id,
        name: usersTable.name,
        email: usersTable.email,
      })
      .from(usersTable)
      .where(eq(usersTable.id, userId))

    if (!user) {
      throw new UnauthorizedException('Pengguna tidak ditemukan')
    }

    await this.db
      .update(usersTable)
      .set({ name: newName })
      .where(eq(usersTable.id, userId))

    await this.activityLogsService.record({
      entityType: 'USER',
      entityId: userId,
      action: 'PROFILE_UPDATED',
      actorId: userId,
      before: { name: user.name },
      after: { name: newName },
    })

    return {
      success: true,
      message: 'Profil berhasil diperbarui.',
      user: {
        id: user.id,
        name: newName,
        email: user.email,
      },
    }
  }

  // ─── Change Password (/auth/change-password) ───────────────────────────────
  async changePassword(userId: string, dto: ChangePasswordDto) {
    const [user] = await this.db
      .select({
        id: usersTable.id,
        email: usersTable.email,
        passwordHash: usersTable.passwordHash,
      })
      .from(usersTable)
      .where(eq(usersTable.id, userId))

    if (!user) {
      throw new UnauthorizedException('Pengguna tidak ditemukan')
    }

    if (user.passwordHash) {
      if (!dto.currentPassword) {
        throw new BadRequestException('Kata sandi saat ini wajib diisi.')
      }
      const isCurrentMatch = await bcrypt.compare(
        dto.currentPassword,
        user.passwordHash,
      )
      if (!isCurrentMatch) {
        throw new BadRequestException('Kata sandi saat ini tidak sesuai.')
      }
    }

    const newHash = await bcrypt.hash(dto.newPassword, 10)
    await this.db
      .update(usersTable)
      .set({ passwordHash: newHash })
      .where(eq(usersTable.id, userId))

    await this.activityLogsService.record({
      entityType: 'USER',
      entityId: userId,
      action: 'PASSWORD_CHANGED',
      actorId: userId,
      after: { email: user.email },
    })

    return {
      success: true,
      message: 'Kata sandi berhasil diperbarui.',
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

      const frontendUrl = this.configService.get<string>(
        'FRONTEND_URL',
        'http://localhost:3001',
      )
      const resetUrl = `${frontendUrl}/reset-password?token=${rawToken}`
      await this.mailService.sendPasswordReset(
        { email: user.email, name: user.name },
        resetUrl,
      )
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
      isKormanit?: boolean
      status: string
    },
    userAgent?: string,
    rememberMe = false,
  ) {
    const sessionId = crypto.randomUUID()
    const rawRefreshToken = crypto.randomBytes(40).toString('hex')
    const refreshTokenHash = this.hashToken(rawRefreshToken)

    const accessTokenTtl = Number(this.configService.get<number>('ACCESS_TOKEN_TTL', 900)) // 15 menit
    const rememberMeTtl = Number(this.configService.get<number>('REFRESH_TOKEN_REMEMBER_TTL', 2592000)) // 30 hari
    const nonRememberTtl = Number(this.configService.get<number>('REFRESH_TOKEN_TTL', 86400)) // 1 hari
    const refreshTokenTtl = rememberMe ? rememberMeTtl : nonRememberTtl

    const isSuperAdmin = user.isSuperAdmin ?? false
    const isKormanit = user.isKormanit ?? false

    const payload = {
      sub: user.id,
      userId: user.id,
      email: user.email,
      name: user.name,
      isSuperAdmin,
      isKormanit,
      role: isSuperAdmin ? 'admin' : isKormanit ? 'kormanit' : 'user',
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
      refreshTokenTtl,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        isSuperAdmin,
        isKormanit,
        status: user.status,
      },
    }
  }

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex')
  }
}
