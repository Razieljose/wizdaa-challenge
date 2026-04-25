/**
 * Generic paginated response wrapper.
 */
export interface IPaginated<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
