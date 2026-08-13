import { IoAdapter } from '@nestjs/platform-socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';
import { Logger } from '@nestjs/common';

// Adaptador de Socket.IO con Redis Pub/Sub. Permite escalar horizontalmente:
// con varios contenedores del backend detrás de un balanceador, todos comparten
// el mismo bus de mensajes vía Redis, así un mensaje publicado en el servidor A
// (p. ej. una novedad nueva) llega a los sockets conectados al servidor B.
//
// Sin esto, el broadcast de `update:new` solo alcanzaría a los clientes del MISMO
// proceso que lo emitió, y el chat en tiempo real se rompería al escalar.
export class RedisIoAdapter extends IoAdapter {
  private readonly logger = new Logger(RedisIoAdapter.name);
  private adapterConstructor: ReturnType<typeof createAdapter> | null = null;

  // Conecta los clientes pub/sub de Redis y construye el adapter. Debe llamarse
  // ANTES de app.useWebSocketAdapter(...) para que createIOServer lo tenga listo.
  async connectToRedis(url: string) {
    const pubClient = createClient({ url });
    const subClient = pubClient.duplicate();

    // Sin estos handlers, un error de conexión (Redis caído) haría crashar el
    // proceso sin mensaje claro. Con ellos queda en los logs y el retry de Redis
    // intenta reconectar automáticamente.
    pubClient.on('error', (err) => this.logger.error(`Redis (pub): ${err.message}`));
    subClient.on('error', (err) => this.logger.error(`Redis (sub): ${err.message}`));

    await Promise.all([pubClient.connect(), subClient.connect()]);
    this.adapterConstructor = createAdapter(pubClient, subClient);
    this.logger.log('Adapter de WebSockets conectado a Redis ✓');
  }

  createIOServer(port: number, options?: any): any {
    const server = super.createIOServer(port, options);
    if (this.adapterConstructor) {
      server.adapter(this.adapterConstructor);
    }
    return server;
  }
}
