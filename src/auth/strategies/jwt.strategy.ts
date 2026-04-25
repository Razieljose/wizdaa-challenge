import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { IJwtPayload } from '../interfaces';
import { IActor, ILocationRole } from '../../shared/interfaces';
import { Role } from '../../shared/types';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserLocationRoleEntity } from '../../user/entities/user-location-role.entity';
import { UserEntity } from '../../user/entities/user.entity';

/**
 * JWT strategy that validates tokens and builds the IActor context
 * from user_location_roles for RBAC.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  private readonly logger = new Logger(JwtStrategy.name);

  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
    @InjectRepository(UserLocationRoleEntity)
    private readonly roleRepo: Repository<UserLocationRoleEntity>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET', 'default-secret-change-me'),
    });
  }

  /**
   * Called by Passport after token verification.
   * Loads user roles and builds the IActor object attached to the request.
   */
  async validate(payload: IJwtPayload): Promise<IActor> {
    this.logger.debug(`Validating JWT for user: ${payload.sub}`);

    const user = await this.userRepo.findOne({ where: { id: payload.sub } });
    if (!user || !user.isActive) {
      this.logger.warn(`User not found or inactive: ${payload.sub}`);
      throw new UnauthorizedException('User not found or inactive');
    }

    const locationRoles = await this.roleRepo.find({
      where: { userId: payload.sub },
    });

    const roles: ILocationRole[] = locationRoles.map((lr) => ({
      locationId: lr.locationId,
      role: lr.role as Role,
    }));

    const employeeLocationIds = roles
      .filter((r) => r.role === Role.EMPLOYEE)
      .map((r) => r.locationId);

    const managedLocationIds = roles
      .filter((r) => r.role === Role.MANAGER)
      .map((r) => r.locationId);

    return {
      id: payload.sub,
      email: user.email,
      name: user.name,
      roles,
      employeeLocationIds,
      managedLocationIds,
    };
  }
}
