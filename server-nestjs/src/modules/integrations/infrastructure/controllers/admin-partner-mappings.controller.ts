import { Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { MappingService } from '../../application/mapping.service';
import { AuthGuard } from '../../../../shared/infrastructure/guards/auth.guard';
import { Roles, RequireAuth } from '../../../../shared/application/decorators/roles.decorator';

// Auditoría y válvula de emergencia de los mapeos declarativos (solo lectura
// + desactivar): los mapeos los autogestiona el partner vía su API key; el
// moderador puede inspeccionar versiones y cortar una que rompa producción.
@ApiTags('Admin · Partners')
@ApiBearerAuth('bearerJWT')
@Controller('api/admin/partners/:partnerId/mappings')
@UseGuards(AuthGuard)
@RequireAuth()
@Roles('moderator')
export class AdminPartnerMappingsController {
  constructor(private readonly mappings: MappingService) {}

  @Get()
  async list(@Param('partnerId') partnerId: string) {
    return this.mappings.adminList(partnerId);
  }

  @Post(':mappingId/deactivate')
  async deactivate(@Param('partnerId') partnerId: string, @Param('mappingId') mappingId: string) {
    return this.mappings.adminDeactivate(partnerId, mappingId);
  }
}