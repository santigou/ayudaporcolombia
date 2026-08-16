import { Controller, Get, Post, Param, Body, Req, UseGuards } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { ModerationService } from '../../application/moderation.service';
import { AuthGuard } from '../../../../shared/infrastructure/guards/auth.guard';
import { Roles, RequireAuth } from '../../../../shared/application/decorators/roles.decorator';
import { AuthenticatedRequest } from '../../../../shared/infrastructure/middleware/auth.middleware';

@Controller('api/moderator')
@ApiExcludeController() // API interna del SPA: fuera del Swagger público (docs de partners)
@UseGuards(AuthGuard)
@RequireAuth()
@Roles('moderator')
export class ModerationController {
  constructor(private readonly moderationService: ModerationService) {}

  @Get('points/pending')
  async pendingPoints() {
    return this.moderationService.getPendingPoints();
  }

  @Post('points/:id/approve')
  async approvePoint(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.moderationService.approvePoint(id, req.user!.userId);
  }

  @Post('points/:id/reject')
  async rejectPoint(@Param('id') id: string, @Req() req: AuthenticatedRequest, @Body() body: { note?: string }) {
    return this.moderationService.rejectPoint(id, req.user!.userId, body.note);
  }

  @Post('points/:id/verify')
  async verifyPoint(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.moderationService.verifyPoint(id, req.user!.userId);
  }

  @Get('requests')
  async pendingRequests() {
    return this.moderationService.getPendingRequests();
  }

  // Cola de solicitudes de cambio de estado (ciclo de vida) hechas por usuarios.
  @Get('status-requests')
  async pendingStatusRequests() {
    return this.moderationService.getPendingStatusRequests();
  }

  @Post('requests/:id/approve')
  async approveRequest(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.moderationService.approveRequest(id, req.user!.userId);
  }

  @Post('requests/:id/reject')
  async rejectRequest(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.moderationService.rejectRequest(id, req.user!.userId);
  }

  // Aprobar/rechazar solicitudes de cambio de estado de un Punto.
  @Post('status-requests/:id/approve')
  async approveStatusRequest(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.moderationService.approveStatusRequest(id, req.user!.userId);
  }

  @Post('status-requests/:id/reject')
  async rejectStatusRequest(@Param('id') id: string, @Req() req: AuthenticatedRequest, @Body() body: { note?: string }) {
    return this.moderationService.rejectStatusRequest(id, req.user!.userId, body.note);
  }
}
