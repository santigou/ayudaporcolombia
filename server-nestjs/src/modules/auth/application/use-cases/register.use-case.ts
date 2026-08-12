import { Injectable } from '@nestjs/common';
import { User } from '../../domain/entities/user.entity';
import { UserRepository } from '../interfaces/user.repository.interface';
import { RegisterDto } from '../dto/register.dto';
import { AuthService } from '../../domain/services/auth.service';
import { Role } from '../../../../shared/domain/enums';
import { ModeratorRequestRepository } from '../../../moderation/application/interfaces/moderator-request.repository.interface';

@Injectable()
export class RegisterUseCase {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly moderatorRequestRepository: ModeratorRequestRepository,
  ) {}

  async execute(dto: RegisterDto): Promise<User> {
    // Check if user already exists
    const existingUser = await this.userRepository.findByEmail(dto.email);
    if (existingUser) {
      throw new Error('User with this email already exists');
    }

    // Validate contact info if provided
    AuthService.validateContactInfo(dto.contactInfo);

    // Hash password
    const passwordHash = await AuthService.hashPassword(dto.password);

    // Determine initial role
    const role = Role.USER;

    // Create user
    const user = User.create({
      id: crypto.randomUUID(),
      name: dto.name.trim(),
      email: dto.email.toLowerCase().trim(),
      passwordHash,
      role,
      contactInfo: dto.contactInfo?.trim(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Save user
    const savedUser = await this.userRepository.save(user);

    // Create moderator request if requested
    if (dto.wantsModerator) {
      // This would be handled by a separate use case or domain service
      // For now, we'll skip this to keep the use case focused
    }

    return savedUser;
  }
}