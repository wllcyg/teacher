import { Module } from '@nestjs/common';
import { TeacherDatabaseModule } from './database/teacher-database.module';
import { TeacherAuthModule } from './auth/teacher-auth.module';
import { TeacherAuthGuard } from './guards/teacher-auth.guard';
import { ClassResolverService } from './common/class-resolver.service';
import { CrudService } from './common/crud.service';
import { CrudController } from './crud/crud.controller';
import { ClassesController, HealthController } from './crud/classes.controller';
import { ReportsController } from './reports/reports.controller';
import { VaultController } from './vault/vault.controller';
import { CardGeneratorService } from './greeting/card-generator.service';
import { GreetingController } from './greeting/greeting.controller';
import { SettingsController } from './settings/settings.controller';
import { DataSource } from 'typeorm';
import { getDataSourceToken } from '@nestjs/typeorm';

@Module({
  imports: [TeacherDatabaseModule, TeacherAuthModule],
  controllers: [
    CrudController,
    ClassesController,
    HealthController,
    ReportsController,
    VaultController,
    GreetingController,
    SettingsController,
  ],
  providers: [
    TeacherAuthGuard,
    ClassResolverService,
    CrudService,
    CardGeneratorService,
    // 将命名数据源 'teacher' 注入为通用 DataSource token
    {
      provide: DataSource,
      useFactory: (ds: DataSource) => ds,
      inject: [getDataSourceToken('teacher')],
    },
  ],
})
export class TeacherModule {}
