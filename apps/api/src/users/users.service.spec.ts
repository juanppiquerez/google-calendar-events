import { Test, TestingModule } from '@nestjs/testing';
import { User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from './users.service';

describe('UsersService', () => {
  let service: UsersService;
  let prisma: { user: { upsert: jest.Mock } };

  const mockUser: User = {
    id: 'user-uuid',
    auth0Id: 'auth0|abc',
    email: 'user@example.com',
    name: 'Test User',
    createdAt: new Date('2025-01-01T00:00:00.000Z'),
  };

  beforeEach(async () => {
    prisma = {
      user: {
        upsert: jest.fn().mockResolvedValue(mockUser),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get(UsersService);
  });

  it('upserts a user by auth0Id', async () => {
    const result = await service.findOrCreateByAuth0Id({
      auth0Id: 'auth0|abc',
      email: 'user@example.com',
      name: 'Test User',
    });

    expect(result).toEqual(mockUser);
    expect(prisma.user.upsert).toHaveBeenCalledWith({
      where: { auth0Id: 'auth0|abc' },
      create: {
        auth0Id: 'auth0|abc',
        email: 'user@example.com',
        name: 'Test User',
      },
      update: {
        email: 'user@example.com',
        name: 'Test User',
      },
    });
  });

  it('does not create duplicate users on concurrent calls', async () => {
    const input = {
      auth0Id: 'auth0|concurrent',
      email: 'concurrent@example.com',
      name: 'Concurrent User',
    };

    await Promise.all([
      service.findOrCreateByAuth0Id(input),
      service.findOrCreateByAuth0Id(input),
      service.findOrCreateByAuth0Id(input),
    ]);

    expect(prisma.user.upsert).toHaveBeenCalledTimes(3);
    for (const call of prisma.user.upsert.mock.calls) {
      expect(call[0]).toEqual({
        where: { auth0Id: 'auth0|concurrent' },
        create: input,
        update: { email: input.email, name: input.name },
      });
    }
  });
});
