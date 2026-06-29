import type { Role } from '../generated/prisma/enums';
import type { ListUsersQueryDto } from '../modules/users/dto/list-users-query.dto';
import type { UpdateUserDto } from '../modules/users/dto/update-user.dto';
import type { UserRecord } from '../modules/users/utils/user-response.mapper';

export const USER_REPOSITORY = Symbol('USER_REPOSITORY');

export type UserWithPassword = UserRecord & {
  passwordHash: string;
};

export type CreateUserInput = {
  email: string;
  name?: string;
  passwordHash: string;
  role: Role;
};

export type SignupUserInput = {
  email: string;
  name?: string;
  passwordHash: string;
};

export type UserListResult = {
  items: UserRecord[];
  total: number;
};

export interface UserRepository {
  create(data: CreateUserInput): Promise<UserRecord>;
  createSignupUser(data: SignupUserInput): Promise<UserWithPassword>;
  findAll(query: ListUsersQueryDto): Promise<UserListResult>;
  findById(id: string): Promise<UserWithPassword | null>;
  findByEmail(email: string): Promise<UserWithPassword | null>;
  update(id: string, data: UpdateUserDto): Promise<UserRecord>;
  delete(id: string): Promise<UserRecord>;
}
