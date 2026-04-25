import { Role } from '../../shared/types';

export class UserOutput {
  id: string;
  email: string;
  name: string;
  isActive: boolean;
  roles: { locationId: string; role: Role }[];
  createdAt: string;
  updatedAt: string;
}
