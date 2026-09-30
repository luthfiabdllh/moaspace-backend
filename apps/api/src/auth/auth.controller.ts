import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  Req,
} from '@nestjs/common'
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger'
import type { Request } from 'express'
import {
  CurrentUser,
  type RequestUser,
} from '../common/decorators/current-user.decorator.js'
import { Public } from '../common/decorators/public.decorator.js'
import { AuthService } from './auth.service.js'
import { ActivateDto } from './dto/activate.dto.js'
import { ForgotPasswordDto } from './dto/forgot-password.dto.js'
import { GoogleAuthDto } from './dto/google-auth.dto.js'
import { LoginDto } from './dto/login.dto.js'
import { ResetPasswordDto } from './dto/reset-password.dto.js'

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Masuk dengan email dan kata sandi' })
  @ApiResponse({ status: 200, description: 'Login berhasil, token diterbitkan' })
  @ApiResponse({ status: 401, description: 'Kredensial salah atau akun belum diaktivasi' })
  async login(@Body() dto: LoginDto, @Req() req: Request) {
    const userAgent = req.headers['user-agent']
    return this.authService.login(dto, userAgent)
  }

  @Public()
  @Post('google')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Masuk dengan Google SSO (OAuth 2.0)' })
  @ApiResponse({ status: 200, description: 'Login Google berhasil' })
  @ApiResponse({ status: 401, description: 'Email Google tidak terdaftar dalam sistem' })
  async googleAuth(@Body() dto: GoogleAuthDto, @Req() req: Request) {
    const userAgent = req.headers['user-agent']
    return this.authService.googleAuth(dto.idToken, userAgent)
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Perbarui access token dengan refresh token' })
  @ApiResponse({ status: 200, description: 'Token berhasil dirotasi' })
  @ApiResponse({ status: 401, description: 'Refresh token tidak valid atau kedaluwarsa' })
  async refresh(
    @Headers('authorization') authHeader: string | undefined,
    @Body('refreshToken') bodyRefreshToken: string | undefined,
    @Req() req: Request,
  ) {
    const userAgent = req.headers['user-agent']
    const tokenFromHeader = authHeader?.startsWith('Bearer ')
      ? authHeader.slice(7)
      : undefined
    const refreshToken = bodyRefreshToken || tokenFromHeader || ''
    return this.authService.refresh(refreshToken, userAgent)
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Keluar dan cabut sesi' })
  @ApiResponse({ status: 200, description: 'Sesi berhasil dicabut' })
  async logout(
    @CurrentUser() user: RequestUser,
    @Headers('authorization') authHeader: string | undefined,
    @Body('refreshToken') bodyRefreshToken: string | undefined,
  ) {
    const tokenFromHeader = authHeader?.startsWith('Bearer ')
      ? authHeader.slice(7)
      : undefined
    const refreshToken = bodyRefreshToken || tokenFromHeader
    return this.authService.logout(user.userId, refreshToken)
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Ambil data profil pengguna yang sedang login' })
  @ApiResponse({ status: 200, description: 'Data profil user dan divisi' })
  async getMe(@CurrentUser() user: RequestUser) {
    return this.authService.getMe(user.userId)
  }

  @Public()
  @Post('activate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Aktivasi akun anggota baru dengan token dan kata sandi' })
  @ApiResponse({ status: 200, description: 'Akun berhasil diaktivasi dan otomatis login' })
  @ApiResponse({ status: 400, description: 'Token aktivasi tidak valid atau kedaluwarsa' })
  async activate(@Body() dto: ActivateDto, @Req() req: Request) {
    const userAgent = req.headers['user-agent']
    return this.authService.activate(dto.token, dto.password, userAgent)
  }

  @Public()
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Minta tautan reset kata sandi melalui email' })
  @ApiResponse({ status: 200, description: 'Instruksi reset kata sandi telah diproses' })
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto.email)
  }

  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset kata sandi dengan token valid' })
  @ApiResponse({ status: 200, description: 'Kata sandi berhasil diubah' })
  @ApiResponse({ status: 400, description: 'Token reset tidak valid atau kedaluwarsa' })
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto.token, dto.password)
  }
}
