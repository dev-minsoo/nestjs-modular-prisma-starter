export class DuplicateUserEmailError extends Error {
  constructor() {
    super('A user with this email already exists');
  }
}

export class UserNotFoundError extends Error {
  constructor(readonly userId?: string) {
    super(userId ? `User ${userId} was not found` : 'User was not found');
  }
}

export class TodoNotFoundError extends Error {
  constructor(readonly todoId: string) {
    super(`Todo ${todoId} was not found`);
  }
}
