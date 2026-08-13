import { Module } from '@nestjs/common';
import { PrismaModule } from '../../shared/infrastructure/database/prisma.module';
import { ModerationController } from './infrastructure/controllers/moderation.controller';
import { ModerationService } from './application/moderation.service';

@Module({
  imports: [PrismaModule],
  controllers: [ModerationController],
  providers: [ModerationService],
})
export class ModerationModule {}
