import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { TOKEN_TTL_SECONDS, TeacherAuthService } from './teacher-auth.service';

// 简单的内存速率限制（与 Python rate_limit.py 逻辑一致）
// 每个 IP 15 分钟内最多 5 次失败
const FAIL_WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES = 5;
const failMap = new Map<string, { count: number; since: number }>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = failMap.get(ip);
  if (!entry || now - entry.since > FAIL_WINDOW_MS) return true;
  return entry.count < MAX_FAILURES;
}

function recordFailure(ip: string): void {
  const now = Date.now();
  const entry = failMap.get(ip);
  if (!entry || now - entry.since > FAIL_WINDOW_MS) {
    failMap.set(ip, { count: 1, since: now });
  } else {
    entry.count += 1;
  }
}

function clearFailures(ip: string): void {
  failMap.delete(ip);
}

@Controller('api/auth')
export class TeacherAuthController {
  constructor(private readonly authService: TeacherAuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(
    @Body() body: { password?: string },
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const ip =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.socket?.remoteAddress ||
      'unknown';

    if (!checkRateLimit(ip)) {
      throw new UnauthorizedException('尝试次数过多，请 15 分钟后再试');
    }

    const password = (body?.password || '').trim();
    if (!password || !this.authService.verifyPassword(password)) {
      recordFailure(ip);
      throw new UnauthorizedException('密码错误');
    }

    clearFailures(ip);
    const token = this.authService.createToken();
    return res.json({
      access_token: token,
      token_type: 'bearer',
      expires_in: TOKEN_TTL_SECONDS,
    });
  }
}
