import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/infrastructure/database/prisma.service';
import { BaseRepository } from '../../../../shared/infrastructure/repositories/base-repository';
import { PointRepository } from '../../application/interfaces/point.repository.interface';
import { Point } from '../../domain/entities/point.entity';
import { PointType, PointStatus, VerificationStatus } from '../../../../shared/domain/enums';

@Injectable()
export class PrismaPointRepository extends BaseRepository<Point> implements PointRepository {
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  async findById(id: string): Promise<Point | null> {
    return this.findUnique('point', { id }, {
      createdBy: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
        },
      },
      helpType: true,
      locations: {
        include: {
          location: true,
        },
      },
      supplies: {
        include: {
          supply: true,
        },
      },
      contacts: true,
      attachments: true,
      verifications: {
        include: {
          moderator: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      },
    });
  }

  async findByType(type: PointType): Promise<Point[]> {
    return this.findMany('point', { type });
  }

  async findByStatus(status: PointStatus): Promise<Point[]> {
    return this.findMany('point', { status });
  }

  async findByTypeAndStatus(type: PointType, status: PointStatus): Promise<Point[]> {
    return this.findMany('point', { type, status });
  }

  async findByVerificationStatus(status: VerificationStatus): Promise<Point[]> {
    return this.findMany('point', { verificationStatus: status });
  }

  async findPublicPoints(type?: PointType): Promise<Point[]> {
    const publicStatuses = [PointStatus.ACTIVE, PointStatus.RESOLVED];
    
    const where: any = {
      status: { in: publicStatuses },
    };

    if (type) {
      where.type = type;
    }

    return this.findMany('point', where, {
      orderBy: { createdAt: 'desc' },
    });
  }

  async findPendingModeration(): Promise<Point[]> {
    return this.findMany('point', {
      type: PointType.OFFER_HELP,
      status: PointStatus.PENDING,
    }, {
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
            contactInfo: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async findByCreatorId(creatorId: string): Promise<Point[]> {
    return this.findMany('point', { createdById: creatorId }, {
      orderBy: { createdAt: 'desc' },
    });
  }

  async findByLocation(
    latitude: number,
    longitude: number,
    radiusKm: number,
  ): Promise<Point[]> {
    const publicStatuses = [PointStatus.ACTIVE, PointStatus.RESOLVED];
    
    return this.findMany('point', {
      status: { in: publicStatuses },
      locations: {
        some: {
          location: {
            latitude: {
              gte: latitude - (radiusKm / 111),
              lte: latitude + (radiusKm / 111),
            },
            longitude: {
              gte: longitude - (radiusKm / 111),
              lte: longitude + (radiusKm / 111),
            },
          },
        },
      },
    });
  }

  async findAll(options?: any): Promise<Point[]> {
    return this.findMany('point', {}, options);
  }

  async save(entity: Point): Promise<Point> {
    const plainPoint = entity.toPlainObject();
    
    const existing = await this.findById(entity.id);
    
    if (existing) {
      return this.update(
        'point',
        { id: entity.id },
        {
          type: plainPoint.type,
          title: plainPoint.title,
          description: plainPoint.description,
          helpTypeId: plainPoint.helpTypeId,
          status: plainPoint.status,
          verificationStatus: plainPoint.verificationStatus,
          updatedAt: new Date(),
        },
      );
    }

    return this.create('point', {
      id: plainPoint.id,
      type: plainPoint.type,
      title: plainPoint.title,
      description: plainPoint.description,
      helpTypeId: plainPoint.helpTypeId,
      status: plainPoint.status,
      verificationStatus: plainPoint.verificationStatus,
      createdById: plainPoint.createdById,
      createdAt: plainPoint.createdAt,
      updatedAt: plainPoint.updatedAt,
      expiresAt: plainPoint.expiresAt,
    });
  }

  async delete(id: string): Promise<void> {
    return this.deleteModel('point', { id });
  }

  protected toDomain(prismaModel: any): Point {
    return Point.create({
      id: prismaModel.id,
      type: prismaModel.type as PointType,
      title: prismaModel.title,
      description: prismaModel.description,
      helpTypeId: prismaModel.helpTypeId,
      status: prismaModel.status as PointStatus,
      verificationStatus: prismaModel.verificationStatus as VerificationStatus,
      createdById: prismaModel.createdById,
      createdAt: prismaModel.createdAt,
      updatedAt: prismaModel.updatedAt,
      expiresAt: prismaModel.expiresAt,
    });
  }

  protected toPersistence(entity: Point): any {
    const plainPoint = entity.toPlainObject();
    return {
      id: plainPoint.id,
      type: plainPoint.type,
      title: plainPoint.title,
      description: plainPoint.description,
      helpTypeId: plainPoint.helpTypeId,
      status: plainPoint.status,
      verificationStatus: plainPoint.verificationStatus,
      createdById: plainPoint.createdById,
      createdAt: plainPoint.createdAt,
      updatedAt: plainPoint.updatedAt,
      expiresAt: plainPoint.expiresAt,
    };
  }
}