// apps/api/src/infrastructure/storage/r2-storage.module.ts
import { Module } from '@nestjs/common';
import { R2StorageService } from './r2-storage.service';

@Module({
  providers: [
    {
      provide: 'IStorageService',
      useClass: R2StorageService,
    },
  ],
  exports: ['IStorageService'],
})
export class R2StorageModule {}