import type { Provider } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import * as schema from '@moaspace/database'
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'

export const DATABASE_CONNECTION = 'DATABASE_CONNECTION'
export type Database = NodePgDatabase<typeof schema>

export const databaseProvider: Provider = {
  provide: DATABASE_CONNECTION,
  inject: [ConfigService],
  useFactory: (configService: ConfigService) => {
    const connectionString = configService.get<string>(
      'DATABASE_URL',
      'postgresql://postgres:postgres@localhost:5432/moaspace',
    )
    const pool = new Pool({ connectionString })
    return drizzle(pool, { schema })
  },
}
