import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../shared/infrastructure/database/prisma.service';

// Forma de una novedad que se emite en tiempo real a la sala del punto. Coincide
// con el shape que devuelven los endpoints REST de novedades (id, message, kind,
// createdAt, createdByEmail). createdAt se deja como Date|string porque Prisma
// entrega un Date que tanto el REST como Socket.IO serializan a ISO string.
export interface UpdatePayload {
  id: string;
  message: string;
  kind: string;
  createdAt: string | Date;
  createdByEmail: string | null;
}

// Nombre de la sala de Socket.IO para un punto concreto: una sala por punto.
export function roomFor(pointId: string): string {
  return `point:${pointId}`;
}

// Gateway de tiempo real para la pestaña "Novedades". Cada punto tiene una sala
// `point:<id>`; al abrirlo el cliente hace `point:join` y recibe `update:new`
// cada vez que alguien publica una novedad, además de `point:presence` con el
// conteo de espectadores. La autenticación es OPCIONAL y se toma de la cookie
// `token` (JWT) del handshake —igual que el AuthMiddleware—: la LECTURA es
// pública (paridad con GET /:id/updates), pero solo usuarios autenticados pueden
// publicar (lo sigue validando el endpoint REST POST /:id/updates).
@WebSocketGateway({ cors: { origin: true, credentials: true } })
export class PointsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(PointsGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async handleConnection(client: Socket) {
    try {
      const token = this.extractToken(client);
      if (!token) {
        client.data.userId = null;
        return;
      }
      const payload = this.jwtService.verify(token);
      const userId = payload.sub ?? payload.userId;
      // Verifica que el usuario del JWT siga existiendo (paridad con AuthGuard).
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, email: true },
      });
      if (user) {
        client.data.userId = user.id;
        client.data.email = user.email;
      } else {
        client.data.userId = null;
      }
    } catch {
      // token inválido/expirado → conexión anónima (puede leer, no publicar).
      client.data.userId = null;
    }
  }

  handleDisconnect(client: Socket) {
    // El socket ya salió de su sala automáticamente. Si estaba viendo un punto,
    // recalculamos la presencia (conteo entre TODOS los procesos vía Redis) y lo
    // anunciamos para que el "N personas viendo" sea correcto en cluster.
    const pointId = client.data?.joinedPointId;
    if (pointId) {
      this.broadcastPresence(pointId).catch(() => {});
    }
  }

  // El cliente se une a la sala del punto para recibir sus novedades en vivo.
  // Emite `point:presence` con el conteo actualizado para que la UI muestre
  // "N personas viendo este punto".
  @SubscribeMessage('point:join')
  async handleJoin(@MessageBody() body: { pointId?: string }, @ConnectedSocket() client: Socket) {
    const pointId = body?.pointId;
    if (!pointId) return { ok: false };
    client.data.joinedPointId = pointId;
    client.join(roomFor(pointId));
    await this.broadcastPresence(pointId);
    return { ok: true };
  }

  @SubscribeMessage('point:leave')
  async handleLeave(@MessageBody() body: { pointId?: string }, @ConnectedSocket() client: Socket) {
    const pointId = body?.pointId;
    if (!pointId) return { ok: false };
    if (client.data?.joinedPointId === pointId) client.data.joinedPointId = null;
    client.leave(roomFor(pointId));
    await this.broadcastPresence(pointId);
    return { ok: true };
  }

  // Recuenta los sockets de la sala del punto ENTRE TODOS los procesos (vía el
  // adaptador de Redis: allSockets() consulta a cada instancia del backend) y
  // anuncia el total. Así el "N personas viendo" es correcto aunque haya varios
  // workers/contenedores. Sin Redis, allSockets() cuenta solo los locales.
  private async broadcastPresence(pointId: string) {
    const room = roomFor(pointId);
    const sockets = await this.server.in(room).allSockets();
    this.server.to(room).emit('point:presence', { pointId, viewers: sockets.size });
  }

  // Lo llama PointService.createUpdate tras crear la novedad: difunde el mensaje
  // a todos los sockets que están viendo ese punto (si hay alguno conectado).
  broadcastUpdate(pointId: string, payload: UpdatePayload) {
    this.server?.to(roomFor(pointId)).emit('update:new', payload);
  }

  private extractToken(client: Socket): string | null {
    const cookieHeader = client.handshake.headers.cookie;
    if (cookieHeader) {
      const match = cookieHeader.match(/token=([^;]+)/);
      if (match) return match[1];
    }
    const authHeader = client.handshake.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }
    return null;
  }
}
