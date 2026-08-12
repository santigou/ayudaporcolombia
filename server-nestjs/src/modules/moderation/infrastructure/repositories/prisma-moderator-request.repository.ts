import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/infrastructure/database/prisma.service';
import { BaseRepository } from '../../../../shared/infrastructure/repositories/base-repository';
import { ModeratorRequestRepository } from '../../application/interfaces/moderator-request.repository.interface';
import { VerificationStatus } from '../../../../shared/domain/enums';

@Injectable()
export class PrismaModeratorRequestRepository extends BaseRepository<any> implements ModeratorRequestRepository {
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  async findById(id: string): Promise<any | null> {
    return this.findUnique('moderatorRequest', { id }, {
      user: true,
      reviewedBy: true,
    });
  }

  async findByStatus(status: VerificationStatus): Promise<any[]> {
    return this.findMany('moderatorRequest', { status }, {
      user: true,
      reviewedBy: true,
      orderBy: { createdAt: 'asc' },
    });
  }

  async findByUserId(userId: string): Promise<any | null> {
    return this.findUnique('moderatorRequest', { userId }, {
      user: true,
      reviewedBy: true,
    });
  }

  async findAll(options?: any): Promise<any[]> {
    return this.findMany('moderatorRequest', {}, options);
  }

  async save(entity: any): Promise<any> {
    const plainEntity = entity.toPlainObject ? entity.toPlainObject() : entity;
    
    const existing = await this.findById(plainEntity.id);
    
    if (existing) {
      return this.update(
        'moderatorRequest',
        { id: plainEntity.id },
        plainEntity,
      );
    }

    return this.create('moderatorRequest', plainEntity);
  }

  async delete(id: string): Promise<void> {
    return this.deleteModel('moderatorRequest', { id });
  }

  protected toDomain(prismaModel: any): any {
    return prismaModel; // Placeholder - proper entity implementation needed
  }

  protected toPersistence(entity: any): any {
    return entity; // Placeholder
  }
}