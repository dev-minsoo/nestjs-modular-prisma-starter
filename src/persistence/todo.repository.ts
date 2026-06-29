import type { ListTodosQueryDto } from '../modules/todos/dto/list-todos-query.dto';
import type { UpdateTodoDto } from '../modules/todos/dto/update-todo.dto';
import type { TodoRecord } from '../modules/todos/utils/todo-response.mapper';

export const TODO_REPOSITORY = Symbol('TODO_REPOSITORY');

export type CreateTodoInput = {
  title: string;
  description?: string;
  ownerId: string;
};

export type ListTodosInput = ListTodosQueryDto & {
  ownerId?: string;
};

export type TodoListResult = {
  items: TodoRecord[];
  total: number;
};

export interface TodoRepository {
  create(data: CreateTodoInput): Promise<TodoRecord>;
  findAll(query: ListTodosInput): Promise<TodoListResult>;
  findById(id: string): Promise<TodoRecord | null>;
  update(id: string, data: UpdateTodoDto): Promise<TodoRecord>;
  delete(id: string): Promise<TodoRecord>;
}
