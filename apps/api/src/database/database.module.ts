import { Global, Module } from '@nestjs/common'
import { DATABASE_CONNECTION, databaseProvider } from './database.provider.js'

@Global()
@Module({
  providers: [databaseProvider],
  exports: [DATABASE_CONNECTION],
})
export class DatabaseModule {}
