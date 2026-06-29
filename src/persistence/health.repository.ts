export const HEALTH_REPOSITORY = Symbol('HEALTH_REPOSITORY');

export interface HealthRepository {
  checkDatabase(): Promise<boolean>;
}
