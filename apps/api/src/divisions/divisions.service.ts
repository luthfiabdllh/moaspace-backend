import { Inject, Injectable } from '@nestjs/common'
import { divisionsTable } from '@moaspace/database'
import { asc } from 'drizzle-orm'
import { DATABASE_CONNECTION, type Database } from '../database/database.provider.js'

@Injectable()
export class DivisionsService {
  constructor(@Inject(DATABASE_CONNECTION) private readonly db: Database) {}

  async findAll() {
    return this.db
      .select({
        id: divisionsTable.id,
        name: divisionsTable.name,
        slug: divisionsTable.slug,
        requestApprovalEnabled: divisionsTable.requestApprovalEnabled,
      })
      .from(divisionsTable)
      .orderBy(asc(divisionsTable.name))
  }
}
