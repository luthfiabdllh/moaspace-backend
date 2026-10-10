import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { Cron } from '@nestjs/schedule'
import { and, eq, inArray, sql } from 'drizzle-orm'
import {
  divisionMembersTable,
  divisionsTable,
  memberCapacitiesTable,
  tasksTable,
  usersTable,
} from '@moaspace/database'
import { DATABASE_CONNECTION, type Database } from '../database/database.provider.js'
import { ActivityLogsService } from '../activity-logs/activity-logs.service.js'
import type { RequestUser } from '../common/decorators/current-user.decorator.js'
import type { CreateCapacityRequestDto } from './dto/create-capacity-request.dto.js'
import type { ReviewCapacityRequestDto } from './dto/review-capacity-request.dto.js'
import { randomUUID } from 'node:crypto'

export interface MemberUtilizationResult {
  userId: string
  userName: string
  userEmail: string
  avatarUrl?: string | null
  weekStart: string
  capacitySp: number
  activeSp: number
  utilizationPercentage: number
  status: 'NORMAL' | 'WARNING' | 'OVERLOAD'
  requestStatus: 'NONE' | 'PENDING' | 'APPROVED' | 'REJECTED'
  requestedSp?: number | null
  note?: string | null
  capacityId: string
}

@Injectable()
export class CapacityService {
  constructor(
    @Inject(DATABASE_CONNECTION) private readonly db: Database,
    private readonly activityLogsService: ActivityLogsService,
  ) {}

  /**
   * Menghitung tanggal hari Senin dari pekan bersangkutan (format YYYY-MM-DD)
   */
  getCurrentWeekStart(inputDate: Date = new Date()): string {
    const d = new Date(inputDate)
    const day = d.getDay() // 0 = Minggu, 1 = Senin, ...
    const diff = d.getDate() - day + (day === 0 ? -6 : 1) // Sesuaikan ke hari Senin
    d.setDate(diff)
    return d.toISOString().split('T')[0] ?? ''
  }

  /**
   * Mengambil atau membuat baris kapasitas mingguan anggota (default 10 SP)
   */
  async getOrCreateMemberCapacity(userId: string, weekStart: string) {
    const [existing] = await this.db
      .select()
      .from(memberCapacitiesTable)
      .where(
        and(
          eq(memberCapacitiesTable.userId, userId),
          eq(memberCapacitiesTable.weekStart, weekStart),
        ),
      )

    if (existing) {
      return existing
    }

    const id = randomUUID()
    const [created] = await this.db
      .insert(memberCapacitiesTable)
      .values({
        id,
        userId,
        weekStart,
        capacitySp: 10,
        requestStatus: 'NONE',
      })
      .returning()

    if (!created) {
      throw new Error('Gagal membuat baris kapasitas mingguan.')
    }

    return created
  }

  /**
   * Menghitung utilisasi satu anggota secara komprehensif lintas semua divisi miliknya
   */
  async getUserUtilization(
    userId: string,
    weekStart?: string,
  ): Promise<MemberUtilizationResult> {
    const monday = weekStart || this.getCurrentWeekStart()

    const [user] = await this.db
      .select({
        id: usersTable.id,
        name: usersTable.name,
        email: usersTable.email,
      })
      .from(usersTable)
      .where(eq(usersTable.id, userId))

    if (!user) {
      throw new NotFoundException('Pengguna tidak ditemukan.')
    }

    const capacity = await this.getOrCreateMemberCapacity(userId, monday)

    // Hitung beban aktif (task ToDo, InProgress, Review) milik anggota lintas seluruh divisi
    const [activeTasksResult] = await this.db
      .select({
        totalActiveSp: sql<string>`coalesce(sum(${tasksTable.storyPoints}), 0)`,
      })
      .from(tasksTable)
      .where(
        and(
          eq(tasksTable.assigneeId, userId),
          inArray(tasksTable.status, ['TODO', 'IN_PROGRESS', 'REVIEW']),
        ),
      )

    const activeSp = Number(activeTasksResult?.totalActiveSp || 0)
    const capacitySp = capacity.capacitySp || 10
    const utilizationPercentage = Math.round((activeSp / capacitySp) * 100)

    let status: 'NORMAL' | 'WARNING' | 'OVERLOAD' = 'NORMAL'
    if (utilizationPercentage > 100) {
      status = 'OVERLOAD'
    } else if (utilizationPercentage >= 70) {
      status = 'WARNING'
    }

    return {
      userId: user.id,
      userName: user.name,
      userEmail: user.email,
      avatarUrl: null,
      weekStart: monday,
      capacitySp,
      activeSp,
      utilizationPercentage,
      status,
      requestStatus: capacity.requestStatus,
      requestedSp: capacity.requestedSp,
      note: capacity.note,
      capacityId: capacity.id,
    }
  }

  /**
   * Mengambil daftar seluruh anggota divisi beserta metrik utilisasi dan status kapasitasnya
   */
  async getDivisionCapacities(
    divisionId: string,
    weekStart?: string,
  ): Promise<MemberUtilizationResult[]> {
    const [division] = await this.db
      .select()
      .from(divisionsTable)
      .where(eq(divisionsTable.id, divisionId))

    if (!division) {
      throw new NotFoundException('Divisi tidak ditemukan.')
    }

    const members = await this.db
      .select({
        userId: divisionMembersTable.userId,
      })
      .from(divisionMembersTable)
      .innerJoin(usersTable, eq(divisionMembersTable.userId, usersTable.id))
      .where(
        and(
          eq(divisionMembersTable.divisionId, divisionId),
          eq(usersTable.status, 'ACTIVE'),
        ),
      )

    const monday = weekStart || this.getCurrentWeekStart()

    const results = await Promise.all(
      members.map((m) => this.getUserUtilization(m.userId, monday)),
    )

    return results
  }

  /**
   * Anggota mengajukan penyesuaian kapasitas mingguan
   */
  async requestAdjustment(user: RequestUser, dto: CreateCapacityRequestDto) {
    const monday = this.getCurrentWeekStart()
    const capacity = await this.getOrCreateMemberCapacity(user.userId, monday)

    const [updated] = await this.db
      .update(memberCapacitiesTable)
      .set({
        requestedSp: dto.requestedSp,
        note: dto.note,
        requestStatus: 'PENDING',
        updatedAt: new Date(),
      })
      .where(eq(memberCapacitiesTable.id, capacity.id))
      .returning()

    await this.activityLogsService.record({
      entityType: 'MEMBER_CAPACITY',
      entityId: capacity.id,
      action: 'CAPACITY_REQUESTED',
      actorId: user.userId,
      after: {
        requestedSp: dto.requestedSp,
        note: dto.note,
        weekStart: monday,
      },
    })

    return updated
  }

  /**
   * Koordinator atau Super Admin menyetujui atau menolak penyesuaian kapasitas anggota
   */
  async reviewAdjustment(
    capacityId: string,
    reviewer: RequestUser,
    dto: ReviewCapacityRequestDto,
  ) {
    const [capacity] = await this.db
      .select()
      .from(memberCapacitiesTable)
      .where(eq(memberCapacitiesTable.id, capacityId))

    if (!capacity) {
      throw new NotFoundException('Data kapasitas tidak ditemukan.')
    }

    // Otorisasi: Super Admin / Kormanit, atau Koordinator divisi dari anggota terkait
    const isGlobalAdmin = Boolean(reviewer.isSuperAdmin || reviewer.isKormanit)
    let isCoordinator = isGlobalAdmin

    if (!isCoordinator) {
      const coordinatorMemberships = await this.db
        .select()
        .from(divisionMembersTable)
        .where(
          and(
            eq(divisionMembersTable.userId, capacity.userId),
            inArray(
              divisionMembersTable.divisionId,
              this.db
                .select({ divisionId: divisionMembersTable.divisionId })
                .from(divisionMembersTable)
                .where(
                  and(
                    eq(divisionMembersTable.userId, reviewer.userId),
                    eq(divisionMembersTable.role, 'COORDINATOR'),
                  ),
                ),
            ),
          ),
        )

      isCoordinator = coordinatorMemberships.length > 0
    }

    if (!isCoordinator) {
      throw new ForbiddenException(
        'Hanya Koordinator divisi anggota atau Super Admin yang dapat meninjau pengajuan kapasitas.',
      )
    }

    let finalCapacitySp = capacity.capacitySp
    const newStatus = dto.action === 'APPROVE' ? 'APPROVED' : 'REJECTED'

    if (dto.action === 'APPROVE') {
      finalCapacitySp =
        dto.approvedSp !== undefined
          ? dto.approvedSp
          : capacity.requestedSp || capacity.capacitySp
    }

    const [updated] = await this.db
      .update(memberCapacitiesTable)
      .set({
        capacitySp: finalCapacitySp,
        requestStatus: newStatus,
        updatedById: reviewer.userId,
        updatedAt: new Date(),
      })
      .where(eq(memberCapacitiesTable.id, capacityId))
      .returning()

    await this.activityLogsService.record({
      entityType: 'MEMBER_CAPACITY',
      entityId: capacityId,
      action: dto.action === 'APPROVE' ? 'CAPACITY_APPROVED' : 'CAPACITY_REJECTED',
      actorId: reviewer.userId,
      before: {
        capacitySp: capacity.capacitySp,
        requestStatus: capacity.requestStatus,
      },
      after: {
        capacitySp: finalCapacitySp,
        requestStatus: newStatus,
        note: dto.note,
      },
    })

    return updated
  }

  /**
   * Cron mingguan: membentuk kapasitas awal seluruh anggota aktif setiap hari Senin pukul 00:00 WIB
   */
  @Cron('0 0 * * 1', { timeZone: 'Asia/Jakarta' })
  async ensureWeeklyCapacities(targetDate: Date = new Date()) {
    const monday = this.getCurrentWeekStart(targetDate)
    const activeUsers = await this.db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.status, 'ACTIVE'))

    let createdCount = 0

    for (const u of activeUsers) {
      const [existing] = await this.db
        .select({ id: memberCapacitiesTable.id })
        .from(memberCapacitiesTable)
        .where(
          and(
            eq(memberCapacitiesTable.userId, u.id),
            eq(memberCapacitiesTable.weekStart, monday),
          ),
        )

      if (!existing) {
        await this.db.insert(memberCapacitiesTable).values({
          id: randomUUID(),
          userId: u.id,
          weekStart: monday,
          capacitySp: 10,
          requestStatus: 'NONE',
        })
        createdCount++
      }
    }

    return { weekStart: monday, activeUsersCount: activeUsers.length, createdCount }
  }
}
