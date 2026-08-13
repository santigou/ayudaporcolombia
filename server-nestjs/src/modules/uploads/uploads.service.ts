import { Inject, Injectable } from '@nestjs/common';
import { STORAGE, Storage } from '../../shared/domain/storage.port';

// Servicio de aplicación para subida de fotos: delega en el adaptador de
// Storage inyectado (SeaweedFS en prod / disco local en dev).
@Injectable()
export class UploadsService {
  constructor(@Inject(STORAGE) private readonly storage: Storage) {}

  presign(filename: string, mimetype: string) {
    return this.storage.presign(filename, mimetype);
  }
}
