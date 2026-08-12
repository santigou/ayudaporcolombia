import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/infrastructure/database/prisma.service';
import { BaseRepository } from '../../../../shared/infrastructure/repositories/base-repository';
import { UserRepository } from '../../application/interfaces/user.repository.interface';
import { User } from '../../domain/entities/user.entity';
import { Role } from '../../../../shared/domain/enums';

@Injectable()
export class PrismaUserRepository extends BaseRepository<User> implements UserRepository {
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  async findById(id: string): Promise<User | null> {
    return this.findUnique('user', { id }, {
      moderatorRequests: true,
    });
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.findUnique('user', { email: email.toLowerCase() }, {
      moderatorRequests: true,
    });
  }

  async findByRole(role: Role): Promise<User[]> {
    return this.findMany('user', { role });
  }

  async existsByEmail(email: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      select: { id: true },
    });
    return !!user;
  }

  async findAll(options?: any): Promise<User[]> {
    return this.findMany('user', {}, options);
  }

  async save(entity: User): Promise<User> {
    const plainUser = entity.toPlainObject();
    
    // Check if user exists
    const existing = await this.findById(entity.id);
    
    if (existing) {
      return this.update(
        'user',
        { id: entity.id },
        {
          name: plainUser.name,
          email: plainUser.email,
          passwordHash: plainUser.passwordHash,
          role: plainUser.role,
          contactInfo: plainUser.contactInfo,
          updatedAt: new Date(),
        },
      );
    }

    return this.create('user', {
      id: plainUser.id,
      name: plainUser.name,
      email: plainUser.email,
      passwordHash: plainUser.passwordHash,
      role: plainUser.role,
      contactInfo: plainUser.contactInfo,
      createdAt: plainUser.createdAt,
      updatedAt: plainUser.updatedAt,
    });
  }

  async delete(id: string): Promise<void> {
    return this.deleteModel('user', { id });
  }

  protected toDomain(prismaModel: any): User {
    return User.create({
      id: prismaModel.id,
      name: prismaModel.name,
      email: prismaModel.email,
      passwordHash: prismaModel.passwordHash,
      role: prismaModel.role as Role,
      contactInfo: prismaModel.contactInfo,
      createdAt: prismaModel.createdAt,
      updatedAt: prismaModel.updatedAt,
    });
  }

  protected toPersistence(entity: User): any {
    const plainUser = entity.toPlainObject();
    return {
      id: plainUser.id,
      name: plainUser.name,
      email: plainUser.email,
      passwordHash: plainUser.passwordHash,
      role: plainUser.role,
      contactInfo: plainUser.contactInfo,
      createdAt: plainUser.createdAt,
      updatedAt: plainUser.updatedAt,
    };
  }
}