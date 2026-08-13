// Helpers de validación de imágenes reutilizados por los adaptadores de Storage.
// (Multer/diskStorage se eliminó: las fotos ahora se suben directo al
// almacenamiento vía URL pre-firmada, sin pasar por el backend.)

// MIME types de imagen permitidos para subida de fotos.
export const IMAGE_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

export function isImageMime(mimetype: string): boolean {
  return IMAGE_MIME.includes(mimetype);
}

// Extensión de fichero a partir de un MIME type de imagen.
export function extFromMime(mimetype: string): string {
  switch (mimetype) {
    case 'image/jpeg':
      return '.jpg';
    case 'image/png':
      return '.png';
    case 'image/webp':
      return '.webp';
    case 'image/gif':
      return '.gif';
    default:
      return '';
  }
}
