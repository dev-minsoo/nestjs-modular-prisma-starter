import { Test, TestingModule } from '@nestjs/testing';
import { ListUsersQueryDto } from './dto/list-users-query.dto';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

describe('UsersController', () => {
  let controller: UsersController;
  let usersService: {
    create: jest.Mock;
    findAll: jest.Mock;
    findOne: jest.Mock;
    update: jest.Mock;
    remove: jest.Mock;
  };

  const now = new Date('2026-06-11T05:00:00.000Z');
  const sampleUser = {
    id: '2e0a35e2-e1d5-4b3f-a5c6-d15ce8f7a524',
    email: 'minsoo@example.com',
    name: 'Minsoo Kim',
    createdAt: now,
    updatedAt: now,
  };

  beforeEach(async () => {
    usersService = {
      create: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        {
          provide: UsersService,
          useValue: usersService,
        },
      ],
    }).compile();

    controller = module.get<UsersController>(UsersController);
  });

  it('delegates create requests to the service', async () => {
    const dto = {
      email: sampleUser.email,
      name: sampleUser.name,
    };

    usersService.create.mockResolvedValue(sampleUser);

    await expect(controller.create(dto)).resolves.toEqual(sampleUser);
    expect(usersService.create).toHaveBeenCalledWith(dto);
  });

  it('delegates list queries to the service', async () => {
    const query: ListUsersQueryDto = {
      page: 1,
      pageSize: 20,
      orderBy: 'createdAt',
      orderDirection: 'desc',
    };
    const result = {
      items: [sampleUser],
      meta: {
        page: 1,
        pageSize: 20,
        total: 1,
        totalPages: 1,
      },
    };

    usersService.findAll.mockResolvedValue(result);

    await expect(controller.findAll(query)).resolves.toEqual(result);
    expect(usersService.findAll).toHaveBeenCalledWith(query);
  });

  it('delegates findOne requests to the service', async () => {
    usersService.findOne.mockResolvedValue(sampleUser);

    await expect(controller.findOne(sampleUser.id)).resolves.toEqual(
      sampleUser,
    );
    expect(usersService.findOne).toHaveBeenCalledWith(sampleUser.id);
  });

  it('delegates update requests to the service', async () => {
    const dto = { name: 'Updated Name' };
    const updatedUser = { ...sampleUser, ...dto };

    usersService.update.mockResolvedValue(updatedUser);

    await expect(controller.update(sampleUser.id, dto)).resolves.toEqual(
      updatedUser,
    );
    expect(usersService.update).toHaveBeenCalledWith(sampleUser.id, dto);
  });

  it('delegates delete requests to the service without a response body', async () => {
    usersService.remove.mockResolvedValue(sampleUser);

    await expect(controller.remove(sampleUser.id)).resolves.toBeUndefined();
    expect(usersService.remove).toHaveBeenCalledWith(sampleUser.id);
  });
});
