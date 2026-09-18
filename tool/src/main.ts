import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // CORS：与 Python 端保持一致
  const devOrigins = [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:4173',
    'http://127.0.0.1:4173',
  ];
  const envOrigins = (
    process.env.ALLOWED_ORIGINS ||
    'https://yg.cheatppf.xyz,https://teacher.cheatppf.xyz'
  )
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  const allowedOrigins = Array.from(new Set([...devOrigins, ...envOrigins]));

  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    // X-New-Token 是登录 Token 自动顺延用的自定义响应头，必须显式 expose
    exposedHeaders: ['X-New-Token'],
  });

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
