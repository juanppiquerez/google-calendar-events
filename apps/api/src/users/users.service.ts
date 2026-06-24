import { Injectable } from '@nestjs/common';
import { User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface UpsertUserInput {
  auth0Id: string;
  email: string;
  name: string;
}

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findOrCreateByAuth0Id(input: UpsertUserInput): Promise<User> {
    const { auth0Id, email, name } = input;

    return this.prisma.user.upsert({
      where: { auth0Id },
      create: { auth0Id, email, name },
      update: { email, name },
    });
  }
}
