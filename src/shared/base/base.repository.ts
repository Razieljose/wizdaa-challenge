import { Repository, FindOptionsWhere, ObjectLiteral, DeepPartial } from 'typeorm';
import { IBaseRepository } from './base.repository.interface';

/**
 * Abstract base repository providing common CRUD operations.
 * All domain repositories should extend this class.
 */
export abstract class BaseRepository<T extends ObjectLiteral> implements IBaseRepository<T> {
  constructor(protected readonly repository: Repository<T>) {}

  async findById(id: string): Promise<T | null> {
    return this.repository.findOne({
      where: { id } as unknown as FindOptionsWhere<T>,
    });
  }

  async findOne(where: FindOptionsWhere<T>): Promise<T | null> {
    return this.repository.findOne({ where });
  }

  async findMany(where?: FindOptionsWhere<T>): Promise<T[]> {
    return this.repository.find({ where });
  }

  async save(entity: T): Promise<T> {
    return this.repository.save(entity as DeepPartial<T>);
  }

  async saveMany(entities: T[]): Promise<T[]> {
    return this.repository.save(entities as DeepPartial<T>[]);
  }

  async remove(entity: T): Promise<T> {
    return this.repository.remove(entity);
  }

  /**
   * Get the underlying TypeORM repository for advanced queries.
   */
  protected getRepository(): Repository<T> {
    return this.repository;
  }
}
