import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { PUBLIC_PATHS, TeacherAuthService } from '../auth/teacher-auth.service';

@Injectable()
export class TeacherAuthGuard implements CanActivate {
  constructor(private readonly authService: TeacherAuthService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const res = context.switchToHttp().getResponse<Response>();

    // 白名单公开路径直接放行
    const path = req.path.replace(/\/$/, '');
    if (PUBLIC_PATHS.has(path)) return true;

    // 1. 优先 Authorization: Bearer <token>
    let token = '';
    const authHeader = req.headers['authorization'] || '';
    if (authHeader.startsWith('Bearer ')) {
      token = authHeader.slice(7).trim();
    } else if (req.query?.token) {
      // 2. 降级：?token= query 参数（供 <img src> 等无法设置请求头的场景）
      token = String(req.query.token).trim();
    }

    if (!token) throw new UnauthorizedException('未登录');

    const result = this.authService.validateToken(token);
    if (!result.valid) throw new UnauthorizedException(result.reason);

    // Token 临近过期时自动续期，通过 X-New-Token 响应头下发
    if (result.shouldRefresh) {
      res.setHeader('X-New-Token', this.authService.createToken());
    }

    return true;
  }
}
