import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { and, eq } from 'drizzle-orm'
import { divisionMembersTable, divisionsTable } from '@moaspace/database'
import { DATABASE_CONNECTION, type Database } from '../../database/database.provider.js'
import {
  DIVISION_ROLE_KEY,
  type DivisionRoleRequired,
} from '../decorators/division-role.decorator.js'
import type { RequestUser } from '../decorators/current-user.decorator.js'

@Injectable()
export class DivisionRoleGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(DATABASE_CONNECTION) private readonly db: Database,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRole = this.reflector.getAllAndOverride<DivisionRoleRequired>(
      DIVISION_ROLE_KEY,
      [context.getHandler(), context.getClass()],
    )

    // Jika endpoint tidak menggunakan decorator @DivisionRole, izinkan lewat
    if (!requiredRole) {
      return true
    }

    const request = context.switchToHttp().getRequest()
    const user = request.user as RequestUser | undefined

    if (!user || !user.userId) {
      throw new UnauthorizedException('Pengguna tidak terautentikasi')
    }

    // Super Admin dan Koordinator Mahasiswa Unit memiliki akses penuh ke seluruh divisi
    if (user.isSuperAdmin || user.isKormanit) {
      return true
    }

    // Ekstrak identitas divisi (ID atau Slug) dari request parameters, body, atau query
    const divisionParam =
      request.params?.divisionId ||
      request.params?.id ||
      request.params?.slug ||
      request.body?.divisionId ||
      request.query?.divisionId

    if (!divisionParam || typeof divisionParam !== 'string') {
      throw new ForbiddenException('Parameter divisi tidak ditemukan pada permintaan.')
    }

    // Cari keanggotaan berdasarkan divisionId atau division slug
    let membership: { role: 'MEMBER' | 'COORDINATOR'; divisionId: string } | undefined

    // 1. Coba cari langsung dengan asumsi divisionParam adalah divisionId
    const [byDivisionId] = await this.db
      .select({
        role: divisionMembersTable.role,
        divisionId: divisionMembersTable.divisionId,
      })
      .from(divisionMembersTable)
      .where(
        and(
          eq(divisionMembersTable.userId, user.userId),
          eq(divisionMembersTable.divisionId, divisionParam),
        ),
      )

    if (byDivisionId) {
      membership = byDivisionId
    } else {
      // 2. Coba cari dengan join jika divisionParam adalah slug divisi
      const [bySlug] = await this.db
        .select({
          role: divisionMembersTable.role,
          divisionId: divisionMembersTable.divisionId,
        })
        .from(divisionMembersTable)
        .innerJoin(
          divisionsTable,
          eq(divisionMembersTable.divisionId, divisionsTable.id),
        )
        .where(
          and(
            eq(divisionMembersTable.userId, user.userId),
            eq(divisionsTable.slug, divisionParam),
          ),
        )

      membership = bySlug
    }

    if (!membership) {
      throw new ForbiddenException('Anda bukan merupakan anggota dari divisi ini.')
    }

    // Jika peran yang dibutuhkan adalah COORDINATOR, pastikan keanggotaan adalah COORDINATOR
    if (requiredRole === 'COORDINATOR' && membership.role !== 'COORDINATOR') {
      throw new ForbiddenException(
        'Aksi ini memerlukan wewenang Koordinator pada divisi ini.',
      )
    }

    // Lampirkan info keanggotaan ke request object untuk kenyamanan controller
    request.divisionMembership = membership
    return true
  }
}
