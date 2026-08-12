import { Repository } from '../../../../shared/domain/base/entity.base';
import { User } from '../../domain/entities/user.entity';
import { Role } from '../../../../shared/domain/enums';

export interface UserRepository extends Repository<User> {
  findByEmail(email: string): Promise<User | null>;
  findByRole(role: Role): Promise<User[]>;
  existsByEmail(email: string): Promise<boolean>;
}