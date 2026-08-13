// Port (hexagonal) para el servicio de almacenamiento de ficheros (fotos).
//
// El backend NO recibe los bytes de las imágenes: solo entrega al frontend una
// URL "pre-firmada" a la que este sube (PUT) directamente al almacenamiento
// (SeaweedFS en prod / disco local en dev). Así el POST /api/points viaja como
// JSON con las URLs ya resueltas, sin multipart ni procesado de bytes en el API.

export interface PresignResult {
  // URL a la que el navegador hace el PUT con el cuerpo crudo del fichero.
  // En modo S3 es una URL pre-firmada (la firma va en query params y vence).
  uploadUrl: string;
  // URL pública (la que se guarda en BD y sirve el <img>).
  publicUrl: string;
  // Método HTTP para subir el fichero.
  method: 'PUT';
  // Cabeceras HTTP que el navegador debe enviar en el PUT (p. ej. Content-Type
  // cuando la URL pre-firmada se firmó con él). Opcional (modo local no usa).
  headers?: Record<string, string>;
}

export const STORAGE = Symbol('STORAGE');

export interface Storage {
  presign(filename: string, mimetype: string): Promise<PresignResult>;
}
