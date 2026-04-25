import { FindOptionsWhere } from 'typeorm';

/**
 * Generic base repository interface.
 * All domain repositories must implement this interface.
 */
export interface IBaseRepository<T> {
  findById(id: string): Promise<T | null>;
  findOne(where: FindOptionsWhere<T>): Promise<T | null>;
  findMany(where?: FindOptionsWhere<T>): Promise<T[]>;
  save(entity: T): Promise<T>;
  saveMany(entities: T[]): Promise<T[]>;
  remove(entity: T): Promise<T>;
}
