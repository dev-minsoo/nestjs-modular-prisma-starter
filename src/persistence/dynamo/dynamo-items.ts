import { Role } from '../../generated/prisma/enums';
import type { TodoRecord } from '../../modules/todos/utils/todo-response.mapper';
import type { UserRecord } from '../../modules/users/utils/user-response.mapper';

export const ADMIN_MARKER_KEY = 'META#ADMIN';

export type DynamoUserItem = {
  pk: string;
  entityType: 'USER';
  id: string;
  email: string;
  name: string | null;
  passwordHash: string;
  role: Role;
  createdAt: string;
  updatedAt: string;
};

export type DynamoEmailItem = {
  pk: string;
  entityType: 'EMAIL';
  email: string;
  userId: string;
  createdAt: string;
};

export type DynamoTodoItem = {
  pk: string;
  entityType: 'TODO';
  id: string;
  title: string;
  description: string | null;
  completed: boolean;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
};

export type DynamoAdminMarkerItem = {
  pk: typeof ADMIN_MARKER_KEY;
  entityType: 'ADMIN_MARKER';
  userId: string;
  createdAt: string;
};

export function userKey(id: string): string {
  return `USER#${id}`;
}

export function emailKey(email: string): string {
  return `EMAIL#${email.toLowerCase()}`;
}

export function todoKey(id: string): string {
  return `TODO#${id}`;
}

export function toUserRecord(item: DynamoUserItem): UserRecord {
  return {
    id: item.id,
    email: item.email,
    name: item.name,
    role: item.role,
    createdAt: new Date(item.createdAt),
    updatedAt: new Date(item.updatedAt),
  };
}

export function toTodoRecord(item: DynamoTodoItem): TodoRecord {
  return {
    id: item.id,
    title: item.title,
    description: item.description,
    completed: item.completed,
    ownerId: item.ownerId,
    createdAt: new Date(item.createdAt),
    updatedAt: new Date(item.updatedAt),
  };
}
