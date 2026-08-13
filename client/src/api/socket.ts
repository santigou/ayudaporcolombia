import { io, type Socket } from "socket.io-client";

// Cliente Socket.IO (singleton). En producción es mismo origen (NestJS sirve el
// SPA y el gateway en el mismo servidor); en desarrollo, el proxy de Vite
// reenvía /socket.io al backend en :4000 (ver vite.config.ts). withCredentials
// envía la cookie httpOnly del JWT para que el gateway autentique el handshake.
//
// transports: ['websocket'] → abre la conexión WebSocket directamente, saltándose
// el handshake HTTP por polling. Es necesario para que el chat funcione en modo
// cluster (varios procesos backend) SIN necesidad de "sticky sessions": cada WS
// vive en un único proceso y Redis sincroniza los mensajes entre todos. Como
// contrapartida, los clientes detrás de proxies que bloquean WebSockets no
// tendrán tiempo real (la app degrada a REST: ven los mensajes al cargar y
// pueden publicar por POST).
let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io({
      withCredentials: true,
      autoConnect: true,
      transports: ["websocket"],
    });
  }
  return socket;
}
