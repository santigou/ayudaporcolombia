import { Injectable, Logger } from '@nestjs/common';

// Eventos de dominio que otros módulos pueden escuchar sin acoplarse entre sí.
// Hoy los publican Points/Moderation y los consume el módulo de integraciones
// (fan-out de puntos hacia apps partner); mañana puede consumirlos cualquier
// otro (notificaciones, analítica, ...).
//
// Es el mismo papel que jugaría un message broker (RabbitMQ, BullMQ/Redis):
// los publicadores solo conocen esta abstracción, por lo que cambiar el
// transporte después no toca el dominio.
export type PointCreatedEvent = {
  type: 'point.created';
  pointId: string;
  // Partner del que originate este punto (si vino de una integración inbound).
  // Se usa para NO reenviarle su propio punto (anti-eco).
  originPartnerId?: string;
};

export type PointUpdatedEvent = {
  type: 'point.updated';
  pointId: string;
  originPartnerId?: string;
};

export type DomainEvent = PointCreatedEvent | PointUpdatedEvent;

export type DomainEventHandler<T extends DomainEvent = DomainEvent> = (event: T) => Promise<void> | void;

// Bus de eventos en proceso (pub/sub tipado). Fire-and-forget: un handler que
// falle NO rompe al emisor ni afecta a los demás handlers.
@Injectable()
export class DomainEventBus {
  private readonly logger = new Logger(DomainEventBus.name);
  private readonly handlers = new Map<DomainEvent['type'], Set<DomainEventHandler<any>>>();

  subscribe<T extends DomainEvent>(type: T['type'], handler: DomainEventHandler<T>): () => void {
    if (!this.handlers.has(type)) this.handlers.set(type, new Set());
    this.handlers.get(type)!.add(handler);
    // Devuelve un "unsubscribe".
    return () => {
      this.handlers.get(type)?.delete(handler);
    };
  }

  publish(event: DomainEvent): void {
    const set = this.handlers.get(event.type);
    if (!set || set.size === 0) return;
    for (const handler of set) {
      Promise.resolve()
        .then(() => handler(event))
        .catch((err) =>
          this.logger.error(`Handler de "${event.type}" falló: ${err?.message ?? err}`, err?.stack),
        );
    }
  }
}