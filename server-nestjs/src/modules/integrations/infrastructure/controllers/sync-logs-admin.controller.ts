import { Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PartnerAdminService } from '../../application/partner-admin.service';
import { AuthGuard } from '../../../../shared/infrastructure/guards/auth.guard';
import { Roles, RequireAuth } from '../../../../shared/application/decorators/roles.decorator';

// Observabilidad de la sincronización con partners (solo moderadores):
// lista de jobs (con filtros) y reintento manual de failed/skipped.
@ApiTags('Admin · Sync logs')
@ApiBearerAuth('bearerJWT')
@Controller('api/admin/sync-logs')
@UseGuards(AuthGuard)
@RequireAuth()
@Roles('moderator')
export class SyncLogsAdminController {
  constructor(private readonly admin: PartnerAdminService) {}

  @Get()
  async list(
    @Query('status') status?: string,
    @Query('partnerId') partnerId?: string,
    @Query('limit') limit?: string,
  ) {
    return this.admin.listSyncLogs({
      status,
      partnerId,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Post(':id/retry')
  async retry(@Param('id') id: string) {
    return this.admin.retrySyncLog(id);
  }
}