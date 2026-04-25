import { Role } from '../types';

/**
 * Represents the authenticated actor performing an operation.
 * Built from JWT claims + user_location_roles at authentication time.
 */
export interface IActor {
  /** User ID (UUID) */
  id: string;

  /** User's email address */
  email: string;

  /** User's display name */
  name: string;

  /** All roles across all locations */
  roles: ILocationRole[];

  /** Convenience: location IDs where user has EMPLOYEE role */
  employeeLocationIds: string[];

  /** Convenience: location IDs where user has MANAGER role */
  managedLocationIds: string[];
}

export interface ILocationRole {
  locationId: string;
  role: Role;
}
