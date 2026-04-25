import { Injectable, Inject, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { IUserService } from '../interfaces/user.service.interface';
import { UserRepository } from '../repositories/user.repository';
import { UserWriteRepository } from '../repositories/user.write.repository';
import { UserRoleRepository } from '../repositories/user-role.repository';
import { CreateUserInput, AssignRoleInput, UserOutput } from '../dto';
import { NotFoundError, ForbiddenError } from '../../shared/exceptions';
import { DateUtil } from '../../shared/utils/date.util';
import { UuidUtil } from '../../shared/utils/uuid.util';
import { UserEntity } from '../entities/user.entity';
import { UserLocationRoleEntity } from '../entities/user-location-role.entity';
import { Role } from '../../shared/types';

@Injectable()
export class UserService implements IUserService {
  private readonly logger = new Logger(UserService.name);

  constructor(
    private readonly userRepository: UserRepository,
    private readonly userWriteRepository: UserWriteRepository,
    private readonly userRoleRepository: UserRoleRepository,
    private readonly jwtService: JwtService,
  ) {}

  async createUser(input: CreateUserInput): Promise<UserOutput> {
    this.logger.log(`Creating user: ${input.email}`);

    const existing = await this.userRepository.findByEmail(input.email);
    if (existing) {
      throw new ForbiddenError(`User with email ${input.email} already exists`, {
        email: input.email,
      });
    }

    const passwordHash = await bcrypt.hash(input.password, 10);

    const user = new UserEntity();
    user.id = UuidUtil.generate();
    user.email = input.email;
    user.name = input.name;
    user.passwordHash = passwordHash;
    user.isActive = true;
    user.createdAt = DateUtil.nowISO();
    user.updatedAt = DateUtil.nowISO();
    user.createdBy = input.createdBy || '';

    const saved = await this.userWriteRepository.save(user);
    return this.toOutput(saved);
  }

  async assignRole(input: AssignRoleInput): Promise<void> {
    this.logger.log(`Assigning role ${input.role} at location ${input.locationId} to user ${input.userId}`);

    const user = await this.userRepository.findById(input.userId);
    if (!user) {
      throw new NotFoundError('User', input.userId);
    }

    // Check if role already exists
    const existing = await this.userRoleRepository.findOne({
      userId: input.userId,
      locationId: input.locationId,
      role: input.role,
    });

    if (existing) {
      this.logger.debug('Role already assigned, skipping');
      return;
    }

    const role = new UserLocationRoleEntity();
    role.id = UuidUtil.generate();
    role.userId = input.userId;
    role.locationId = input.locationId;
    role.role = input.role;
    role.createdAt = DateUtil.nowISO();
    role.updatedAt = DateUtil.nowISO();
    role.createdBy = input.assignedBy || '';

    await this.userRoleRepository.save(role);  // role repo unified (read+write) — join table
  }

  async findById(id: string): Promise<UserOutput> {
    const user = await this.userRepository.findById(id);
    if (!user) {
      throw new NotFoundError('User', id);
    }
    return this.toOutput(user);
  }

  async findByEmail(email: string): Promise<UserOutput> {
    const user = await this.userRepository.findByEmail(email);
    if (!user) {
      throw new NotFoundError('User', email);
    }
    return this.toOutput(user);
  }

  async login(email: string, password: string): Promise<{ accessToken: string; user: UserOutput }> {
    this.logger.log(`Login attempt: ${email}`);

    const user = await this.userRepository.findByEmail(email);
    if (!user) {
      throw new NotFoundError('User', email);
    }

    if (!user.isActive) {
      throw new ForbiddenError('User account is deactivated');
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      throw new ForbiddenError('Invalid credentials');
    }

    const payload = { sub: user.id, email: user.email, name: user.name };
    const accessToken = this.jwtService.sign(payload);

    return {
      accessToken,
      user: await this.toOutput(user),
    };
  }

  private async toOutput(user: UserEntity): Promise<UserOutput> {
    const locationRoles = await this.userRoleRepository.findByUserId(user.id);

    const output = new UserOutput();
    output.id = user.id;
    output.email = user.email;
    output.name = user.name;
    output.isActive = user.isActive;
    output.createdAt = user.createdAt;
    output.updatedAt = user.updatedAt;
    output.roles = locationRoles.map((lr) => ({
      locationId: lr.locationId,
      role: lr.role as Role,
    }));

    return output;
  }
}
