import { Global, Module } from '@nestjs/common';
import { DomainEventBus } from './event-bus';

// Módulo global: el bus es infraestructura compartida transversal (igual que
// PrismaModule) para que cualquier módulo pueda publicar/escuchar sin imports.
@Global()
@Module({
  providers: [DomainEventBus],
  exports: [DomainEventBus],
})
export class DomainEventBusModule {}