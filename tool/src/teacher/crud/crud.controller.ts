/**
 * 通用 CRUD 控制器
 *
 * 路由模式：/api/tables/:table（列表/新建/批量操作）
 *           /api/tables/:table/:id（详情/更新/删除）
 *
 * 对应 Python routers.py 中 _register_crud() 注册的全部端点。
 */
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { TeacherAuthGuard } from '../guards/teacher-auth.guard';
import { TABLE_COLUMNS } from '../common/enums';
import { CrudService, ListQuery } from '../common/crud.service';

@Controller('api/tables')
@UseGuards(TeacherAuthGuard)
export class CrudController {
  constructor(private readonly crud: CrudService) {}

  // ---------- 表结构说明 ----------
  @Get()
  listTables() {
    const { NATURAL_KEY } = require('../common/enums');
    return Object.fromEntries(
      Object.entries(TABLE_COLUMNS).map(([t, cols]) => [
        t,
        { columns: cols, natural_key: NATURAL_KEY[t] ?? null },
      ]),
    );
  }

  // ---------- 列表 ----------
  @Get(':table')
  listRows(@Param('table') table: string, @Req() req: Request) {
    const query: ListQuery = {};
    for (const [k, v] of Object.entries(req.query)) {
      query[k] = v;
    }
    return this.crud.list(table, query);
  }

  // ---------- 批量操作（在 :id 之前注册，防止 "batch-create" 被当成 id） ----------
  @Post(':table/batch-create')
  batchCreate(
    @Param('table') table: string,
    @Body() body: { rows: Record<string, any>[] },
  ) {
    return this.crud.batchCreate(table, body.rows ?? []);
  }

  @Post(':table/batch-delete')
  batchDelete(
    @Param('table') table: string,
    @Body() body: { ids: number[] },
  ) {
    return this.crud.batchDelete(table, body.ids ?? []);
  }

  @Post(':table/batch-update')
  batchUpdate(
    @Param('table') table: string,
    @Body() body: { ids: number[]; updates: Record<string, any> },
  ) {
    return this.crud.batchUpdate(table, body.ids ?? [], body.updates ?? {});
  }

  // ---------- 单行 CRUD ----------
  @Get(':table/:id')
  getRow(@Param('table') table: string, @Param('id') id: string) {
    return this.crud.getById(table, Number(id));
  }

  @Post(':table')
  createRow(
    @Param('table') table: string,
    @Body() body: Record<string, any>,
  ) {
    return this.crud.create(table, body);
  }

  @Put(':table/:id')
  updateRow(
    @Param('table') table: string,
    @Param('id') id: string,
    @Body() body: Record<string, any>,
  ) {
    return this.crud.update(table, Number(id), body);
  }

  @Delete(':table/:id')
  deleteRow(@Param('table') table: string, @Param('id') id: string) {
    return this.crud.delete(table, Number(id));
  }
}
