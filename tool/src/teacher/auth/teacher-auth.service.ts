import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';

// Token 有效期与续期阈值（与 Python 端完全一致）
export const TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 天
export const REFRESH_THRESHOLD_SECONDS = 7 * 24 * 60 * 60; // 7 天内自动续期

/** 免认证公开路径白名单 */
export const PUBLIC_PATHS = new Set(['/api/daily-greeting/card']);

function sha256hex(raw: string): string {
  return crypto.createHash('sha256').update(raw, 'utf8').digest('hex');
}

function resolvePasswordHash(): string {
  const hashEnv = (process.env.APP_PASSWORD_HASH || '').trim();
  if (hashEnv) return hashEnv;
  const plainEnv = (process.env.APP_PASSWORD || '').trim();
  if (plainEnv) return sha256hex(plainEnv);
  return sha256hex('123456qw');
}

function b64encode(data: Buffer): string {
  return data.toString('base64url').replace(/=+$/, '');
}

function b64decode(data: string): Buffer {
  const padding = '='.repeat((-data.length) & 3);
  return Buffer.from(data + padding, 'base64url');
}

@Injectable()
export class TeacherAuthService {
  private get passwordHash(): string {
    return resolvePasswordHash();
  }

  private get secretKey(): string {
    return (process.env.APP_SECRET_KEY || '').trim() ||
      'teacher-workbench-dev-secret-please-override-in-prod';
  }

  /** 恒定时间比较，防时序攻击 */
  verifyPassword(raw: string): boolean {
    const inputHash = sha256hex(raw || '');
    // 用 timingSafeEqual 防止时序攻击
    try {
      return crypto.timingSafeEqual(
        Buffer.from(inputHash, 'utf8'),
        Buffer.from(this.passwordHash, 'utf8'),
      );
    } catch {
      return false;
    }
  }

  private sign(payloadB64: string): string {
    const sig = crypto
      .createHmac('sha256', this.secretKey)
      .update(payloadB64, 'ascii')
      .digest();
    return b64encode(sig);
  }

  createToken(ttlSeconds = TOKEN_TTL_SECONDS): string {
    const payload = JSON.stringify({ exp: Date.now() / 1000 + ttlSeconds });
    const payloadB64 = b64encode(Buffer.from(payload, 'utf8'));
    return `${payloadB64}.${this.sign(payloadB64)}`;
  }

  /** 验证 token，返回 payload 或 null */
  decodeToken(token: string): { exp: number } | null {
    const dotIdx = token.indexOf('.');
    if (dotIdx === -1) return null;
    const payloadB64 = token.slice(0, dotIdx);
    const signature = token.slice(dotIdx + 1);

    const expected = this.sign(payloadB64);
    try {
      if (
        !crypto.timingSafeEqual(
          Buffer.from(signature, 'utf8'),
          Buffer.from(expected, 'utf8'),
        )
      )
        return null;
    } catch {
      return null;
    }

    try {
      const payload = JSON.parse(b64decode(payloadB64).toString('utf8'));
      if (typeof payload?.exp !== 'number') return null;
      return payload as { exp: number };
    } catch {
      return null;
    }
  }

  /**
   * 校验 token 有效性。
   * 返回：{ valid: true, shouldRefresh: boolean } 或 { valid: false, reason: string }
   */
  validateToken(token: string):
    | { valid: true; shouldRefresh: boolean }
    | { valid: false; reason: string } {
    const payload = this.decodeToken(token);
    if (!payload) return { valid: false, reason: '登录已失效，请重新登录' };

    const now = Date.now() / 1000;
    if (payload.exp < now) return { valid: false, reason: '登录已过期，请重新登录' };

    return {
      valid: true,
      shouldRefresh: payload.exp - now < REFRESH_THRESHOLD_SECONDS,
    };
  }
}
