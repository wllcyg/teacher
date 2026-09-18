import { Module } from '@nestjs/common';
import { TeacherAuthController } from './teacher-auth.controller';
import { TeacherAuthService } from './teacher-auth.service';

@Module({
  providers: [TeacherAuthService],
  controllers: [TeacherAuthController],
  exports: [TeacherAuthService],
})
export class TeacherAuthModule {}
