import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { STORAGE } from '../../domain/storage.port';
import { SeaweedfsStorage } from './seaweedfs.storage';
import { LocalStorage } from './local.storage';

// Provee el adaptador de Storage según STORAGE_DRIVER:
//   - 'seaweedfs' → SeaweedfsStorage (CDN en producción)
//   - cualquier otro (por defecto 'local') → LocalStorage (disco en desarrollo)
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: STORAGE,
      useFactory: (config: ConfigService) => {
        const driver = (config.get<string>('STORAGE_DRIVER') || 'local').toLowerCase();
        return driver === 'seaweedfs' ? new SeaweedfsStorage(config) : new LocalStorage(config);
      },
      inject: [ConfigService],
    },
  ],
  exports: [STORAGE],
})
export class StorageModule {}
