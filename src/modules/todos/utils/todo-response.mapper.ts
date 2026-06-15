export type TodoRecord = {
  id: string;
  title: string;
  description: string | null;
  completed: boolean;
  ownerId: string;
  createdAt: Date;
  updatedAt: Date;
};

export function toTodoResponse(todo: TodoRecord) {
  return {
    id: todo.id,
    title: todo.title,
    description: todo.description,
    completed: todo.completed,
    ownerId: todo.ownerId,
    createdAt: todo.createdAt,
    updatedAt: todo.updatedAt,
  };
}
