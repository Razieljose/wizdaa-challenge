import { CreateUserInput, AssignRoleInput, UserOutput } from '../dto';

export interface IUserService {
  createUser(input: CreateUserInput): Promise<UserOutput>;
  assignRole(input: AssignRoleInput): Promise<void>;
  findById(id: string): Promise<UserOutput>;
  findByEmail(email: string): Promise<UserOutput>;
  login(email: string, password: string): Promise<{ accessToken: string; user: UserOutput }>;
}
