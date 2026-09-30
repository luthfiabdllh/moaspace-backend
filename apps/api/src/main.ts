import { Logger, ValidationPipe } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { NestFactory } from '@nestjs/core'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import { apiReference } from '@scalar/nestjs-api-reference'
import { AppModule } from './app.module.js'

async function bootstrap() {
  const app = await NestFactory.create(AppModule)
  const configService = app.get(ConfigService)
  const logger = new Logger('MoaSpace')

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  )

  // Enable CORS
  app.enableCors({
    origin: true,
    credentials: true,
  })

  // OpenAPI / Swagger Documentation
  const swaggerConfig = new DocumentBuilder()
    .setTitle('MoaSpace API')
    .setDescription('MoaSpace Modular REST API documentation')
    .setVersion('1.0')
    .addBearerAuth()
    .build()

  const document = SwaggerModule.createDocument(app, swaggerConfig)
  SwaggerModule.setup('swagger', app, document)

  // Scalar UI documentation
  app.use(
    '/docs',
    apiReference({
      content: document,
      theme: 'purple',
    }),
  )

  // OpenAPI JSON/YAML endpoint for type generator
  app.getHttpAdapter().get('/openapi.yaml', (_req, res) => {
    res.type('application/json').send(document)
  })
  app.getHttpAdapter().get('/openapi.json', (_req, res) => {
    res.type('application/json').send(document)
  })

  const port = configService.get<number>('PORT', 3000)
  await app.listen(port)

  const env = configService.get<string>('NODE_ENV', 'development')
  const baseUrl = `http://localhost:${port}`

  const banner = `
┌─────────────────────────────────────────────────────┐
│                 MoaSpace API Server                 │
├─────────────────────────────────────────────────────┤
│  Environment:  ${env.padEnd(35)}  │
│  Port:         ${String(port).padEnd(35)}  │
│  Node:         ${process.version.padEnd(35)}  │
├─────────────────────────────────────────────────────┤
│  Endpoints:                                         │
│  - App:        ${baseUrl.padEnd(35)}  │
│  - Docs:       ${`${baseUrl}/docs`.padEnd(35)}  │
│  - Swagger:    ${`${baseUrl}/swagger`.padEnd(35)}  │
│  - Health:     ${`${baseUrl}/health`.padEnd(35)}  │
└─────────────────────────────────────────────────────┘`

  logger.log(banner)
}

bootstrap()
