import { Injectable, UnprocessableEntityException } from '@nestjs/common'

export type TaskStatus = 'BACKLOG' | 'TODO' | 'IN_PROGRESS' | 'REVIEW' | 'DONE'

export interface TaskTransitionInput {
  id: string
  status: TaskStatus
  assigneeId: string | null
  storyPoints?: number | null
  divisionId: string
  revisionCount: number
  startedAt: Date | null
}

export interface TransitionActor {
  userId: string
  isCoordinator: boolean
  isAssignee: boolean
}

export interface TaskTransitionResult {
  status: TaskStatus
  startedAt?: Date | null
  completedAt?: Date | null
  spLockedAt?: Date | null
  revisionCount?: number
}

@Injectable()
export class TaskTransitionService {
  /**
   * Memvalidasi aturan matriks transisi status Kanban sesuai PRD Workflow 4:
   * 1. BACKLOG -> TODO: Hanya oleh Koordinator (syarat: Story Point terisi & Assignee dipilih)
   * 2. TODO -> IN_PROGRESS: Hanya oleh Assignee (startedAt otomatis dicatat; SP dikunci)
   * 3. IN_PROGRESS -> REVIEW: Hanya oleh Assignee
   * 4. REVIEW -> DONE: Hanya oleh Koordinator (completedAt dicatat; auto-close Story)
   * 5. REVIEW -> IN_PROGRESS: Hanya oleh Koordinator (Revisi: revisionCount + 1)
   * 6. DONE -> status lain: Hanya oleh Koordinator (re-open)
   * - Member biasa hanya boleh menggeser task miliknya dari TODO -> IN_PROGRESS atau IN_PROGRESS -> REVIEW.
   * - Transisi tidak sah ditolak dengan HTTP 422 Unprocessable Entity.
   */
  validateTransition(
    task: TaskTransitionInput,
    targetStatus: TaskStatus,
    actor: TransitionActor,
  ): TaskTransitionResult {
    const { isCoordinator, isAssignee } = actor

    // Jika status tidak berubah (hanya reorder posisi kartu di dalam kolom yang sama)
    if (task.status === targetStatus) {
      return { status: targetStatus }
    }

    // ── Matriks Transisi ──────────────────────────────────────────────────────

    // Transisi A: BACKLOG -> TODO
    if (task.status === 'BACKLOG' && targetStatus === 'TODO') {
      if (!isCoordinator) {
        throw new UnprocessableEntityException(
          'Hanya Koordinator yang dapat memindahkan task dari Backlog ke To Do.',
        )
      }
      if (!task.storyPoints) {
        throw new UnprocessableEntityException(
          'Estimasi Story Point (skala 1, 2, 3, 5, 8) wajib diisi sebelum memindahkan task ke To Do.',
        )
      }
      if (!task.assigneeId) {
        throw new UnprocessableEntityException(
          'Assignee wajib ditentukan sebelum memindahkan task ke To Do.',
        )
      }
      return { status: 'TODO' }
    }

    // Transisi B: TODO -> IN_PROGRESS
    if (task.status === 'TODO' && targetStatus === 'IN_PROGRESS') {
      if (!isAssignee && !isCoordinator) {
        throw new UnprocessableEntityException(
          'Hanya Assignee yang ditugaskan yang dapat memulai pengerjaan task (In Progress).',
        )
      }
      return {
        status: 'IN_PROGRESS',
        startedAt: task.startedAt || new Date(),
        spLockedAt: new Date(),
      }
    }

    // Transisi C: IN_PROGRESS -> REVIEW
    if (task.status === 'IN_PROGRESS' && targetStatus === 'REVIEW') {
      if (!isAssignee && !isCoordinator) {
        throw new UnprocessableEntityException(
          'Hanya Assignee yang dapat mengajukan task untuk di-review.',
        )
      }
      return { status: 'REVIEW' }
    }

    // Transisi D: REVIEW -> DONE
    if (task.status === 'REVIEW' && targetStatus === 'DONE') {
      if (!isCoordinator) {
        throw new UnprocessableEntityException(
          'Hanya Koordinator divisi yang dapat menyetujui dan menyelesaikan task (Done).',
        )
      }
      return {
        status: 'DONE',
        completedAt: new Date(),
      }
    }

    // Transisi E: REVIEW -> IN_PROGRESS (Revisi)
    if (task.status === 'REVIEW' && targetStatus === 'IN_PROGRESS') {
      if (!isCoordinator) {
        throw new UnprocessableEntityException(
          'Hanya Koordinator yang dapat mengembalikan task untuk revisi.',
        )
      }
      return {
        status: 'IN_PROGRESS',
        revisionCount: task.revisionCount + 1,
      }
    }

    // Transisi F: Keluar dari DONE (Re-open)
    if (task.status === 'DONE') {
      if (!isCoordinator) {
        throw new UnprocessableEntityException(
          'Hanya Koordinator yang dapat membuka kembali task yang sudah selesai.',
        )
      }
      return {
        status: targetStatus,
        completedAt: null,
      }
    }

    // Transisi G: Koordinator mengembalikan TODO ke BACKLOG atau IN_PROGRESS ke TODO
    if (isCoordinator) {
      if (task.status === 'TODO' && targetStatus === 'BACKLOG') {
        return { status: 'BACKLOG' }
      }
      if (task.status === 'IN_PROGRESS' && targetStatus === 'TODO') {
        return { status: 'TODO' }
      }
    }

    // Semua rute transisi lainnya tidak diizinkan
    throw new UnprocessableEntityException(
      `Transisi status dari ${task.status} ke ${targetStatus} tidak diperbolehkan sesuai aturan alur kerja.`,
    )
  }
}
