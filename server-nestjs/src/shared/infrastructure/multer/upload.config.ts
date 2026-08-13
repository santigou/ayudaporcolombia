import { diskStorage } from 'multer';
import { existsSync, mkdirSync } from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

const UPLOAD_DIR = path.join(process.cwd(), 'uploads');
if (!existsSync(UPLOAD_DIR)) mkdirSync(UPLOAD_DIR, { recursive: true });

// Configuración de multer a disco local, idéntica al backend Express original:
// destino process.cwd()/uploads, nombre = UUID + extensión, máx 5 imágenes.
export const photosStorage = diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${crypto.randomUUID()}${ext}`);
  },
});

const IMAGE_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

export const photosFileFilter = (
  _req: any,
  file: Express.Multer.File,
  cb: (error: Error | null, acceptFile: boolean) => void,
) => {
  if (IMAGE_MIME.includes(file.mimetype)) cb(null, true);
  else cb(new Error('Solo se permiten imágenes'), false);
};
