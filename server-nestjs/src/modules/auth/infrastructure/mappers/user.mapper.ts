import { User } from '../../domain/entities/user.entity';
import { Role } from '../../../../shared/domain/enums';

export class UserMapper {
  static toPlainObject(user: User) {
    return user.toPlainObject();
  }

  static toResponse(user: User) {
    const plainUser = user.toPlainObject();
    return {
      id: plainUser.id,
      name: plainUser.name,
      email: plainUser.email,
      role: plainUser.role,
      contactInfo: plainUser.contactInfo,
    };
  }
}