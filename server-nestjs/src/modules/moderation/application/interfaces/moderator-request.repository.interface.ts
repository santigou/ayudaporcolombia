import { Repository } from '../../../../shared/domain/base/entity.base';
import { VerificationStatus } from '../../../../shared/domain/enums';

export interface ModeratorRequestRepository extends Repository<any> {
  findByStatus(status: VerificationStatus): Promise<any[]>;
  findByUserId(userId: string): Promise<any | null>;
}