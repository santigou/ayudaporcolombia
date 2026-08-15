import { Module } from '@nestjs/common';
import { IntegrationsController } from './infrastructure/controllers/integrations.controller';
import { PartnersAdminController } from './infrastructure/controllers/partners-admin.controller';
import { SyncLogsAdminController } from './infrastructure/controllers/sync-logs-admin.controller';
import { PartnerMappingsController } from './infrastructure/controllers/partner-mappings.controller';
import { AdminPartnerMappingsController } from './infrastructure/controllers/admin-partner-mappings.controller';
import { PartnersPublicController, PartnerSelfController, PartnerDeliveriesController } from './infrastructure/controllers/partners-public.controller';
import { SecretsService } from './infrastructure/secrets.service';
import { GenericMapper } from './infrastructure/mappers/generic.mapper';
import { DbSyncQueue } from './infrastructure/db-sync-queue';
import { PartnerClient } from './infrastructure/partner-client';
import { SyncWorkerService } from './infrastructure/sync-worker.service';
import { ApiKeyGuard } from './infrastructure/guards/api-key.guard';
import { MappingEngine } from './infrastructure/mapping-engine/engine';
import { MapperRegistry, PARTNER_MAPPERS } from './application/mapper-registry.service';
import { InboundService } from './application/inbound.service';
import { OutboundService } from './application/outbound.service';
import { SyncDispatcherService } from './application/sync-dispatcher.service';
import { PartnerAdminService } from './application/partner-admin.service';
import { MappingService } from './application/mapping.service';
import { SyncQueuePort } from './domain/sync-queue.port';
import { PartnerMapper } from './domain/partner-mapper.port';

// Módulo de integraciones (federación de puntos con otras apps de ayuda):
//
//   INBOUND   partner → POST /api/integrations/v1/points (ApiKeyGuard) →
//             InboundService. Mapper = mapeo declarativo JSONata activo en BD
//             (autogestionado en /v1/mappings) o el contrato genérico.
//   OUTBOUND  eventos de dominio → SyncDispatcher (broadcast, anti-eco) →
//             cola PartnerSyncLog → SyncWorker → OutboundService (mapper
//             inverso) → PartnerClient (webhook con api_key o login+Bearer).
//
// PrismaService (global) y DomainEventBus (global) no necesitan import.
@Module({
  controllers: [
    IntegrationsController,
    PartnersAdminController,
    SyncLogsAdminController,
    PartnerMappingsController,
    AdminPartnerMappingsController,
    PartnersPublicController,
    PartnerSelfController,
    PartnerDeliveriesController,
  ],
  providers: [
    SecretsService,
    GenericMapper,
    // Registro de mappers de CÓDIGO: añade aquí los mappers custom de cada
    // partner. Los declarativos (JSONata en BD) no requieren tocar esto.
    {
      provide: PARTNER_MAPPERS,
      useFactory: (generic: GenericMapper) => [generic] as PartnerMapper[],
      inject: [GenericMapper],
    },
    MapperRegistry,
    MappingEngine,
    MappingService,
    InboundService,
    OutboundService,
    SyncDispatcherService,
    PartnerClient,
    { provide: SyncQueuePort, useClass: DbSyncQueue },
    SyncWorkerService,
    PartnerAdminService,
    ApiKeyGuard,
  ],
})
export class IntegrationsModule {}