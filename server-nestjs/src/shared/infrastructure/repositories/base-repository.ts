import { PrismaService } from '../database/prisma.service';
import { Repository as IRepository, Entity } from '../../domain/base/entity.base';

/**
 * Base Repository implementation
 * Provides common Prisma repository operations
 */
export abstract class BaseRepository<T extends Entity> implements IRepository<T> {
  constructor(protected readonly prisma: PrismaService) {}

  abstract findById(id: string): Promise<T | null>;
  abstract findAll(options?: any): Promise<T[]>;
  abstract save(entity: T): Promise<T>;
  abstract delete(id: string): Promise<void>;

  protected abstract toDomain(prismaModel: any): T;
  protected abstract toPersistence(entity: T): any;

  protected async findUnique(
    modelName: string,
    where: any,
    include?: any,
  ): Promise<T | null> {
    const prismaModel = await (this.prisma as any)[modelName].findUnique({
      where,
      include,
    });

    return prismaModel ? this.toDomain(prismaModel) : null;
  }

  protected async findMany(
    modelName: string,
    where: any = {},
    options: any = {},
  ): Promise<T[]> {
    const prismaModels = await (this.prisma as any)[modelName].findMany({
      where,
      ...options,
    });

    return prismaModels.map((model: any) => this.toDomain(model));
  }

  protected async create(
    modelName: string,
    data: any,
    include?: any,
  ): Promise<T> {
    const prismaModel = await (this.prisma as any)[modelName].create({
      data,
      include,
    });

    return this.toDomain(prismaModel);
  }

  protected async update(
    modelName: string,
    where: any,
    data: any,
    include?: any,
  ): Promise<T> {
    const prismaModel = await (this.prisma as any)[modelName].update({
      where,
      data,
      include,
    });

    return this.toDomain(prismaModel);
  }

  protected async deleteModel(modelName: string, where: any): Promise<void> {
    await (this.prisma as any)[modelName].delete({ where });
  }
}