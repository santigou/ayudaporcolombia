import { Module } from '@nestjs/common';
import { PrismaModule } from '../../shared/infrastructure/database/prisma.module';

// Placeholder implementation - full moderation will be implemented later
@Module({
  imports: [PrismaModule],
})
export class ModerationModule {}