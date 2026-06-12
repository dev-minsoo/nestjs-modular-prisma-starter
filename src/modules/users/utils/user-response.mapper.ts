import type { Role } from '../../../generated/prisma/enums';
import type { UserResponseDto } from '../dto/user-response.dto';

export type UserRecord = {
  id: string;
  email: string;
  name: string | null;
  role: Role;
  createdAt: Date;
  updatedAt: Date;
};

export function toUserResponse(user: UserRecord): UserResponseDto {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}
