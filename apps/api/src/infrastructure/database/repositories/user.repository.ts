// apps/api/src/infrastructure/database/repositories/user.repository.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { User } from '@/domain/user/user.entity';
import { IUserRepository } from '@/domain/user/user.repository.interface';

@Injectable()
export class PrismaUserRepository implements IUserRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<User | null> {
    const record = await this.prisma.user.findUnique({ where: { id } });
    if (!record) return null;
    return this.toEntity(record);
  }

  async findByEmail(email: string): Promise<User | null> {
    const record = await this.prisma.user.findUnique({ where: { email } });
    if (!record) return null;
    return this.toEntity(record);
  }

  async findByOAuthSub(oauthSub: string): Promise<User | null> {
    const record = await this.prisma.user.findFirst({ where: { oauthSub } });
    if (!record) return null;
    return this.toEntity(record);
  }

  async upsert(data: {
    email: string;
    name: string;
    avatarUrl?: string | null;
    oauthProvider: string;
    oauthSub: string;
  }): Promise<User> {
    // Try to find by oauthSub first, then by email
    const existingBySub = data.oauthSub
      ? await this.prisma.user.findFirst({ where: { oauthSub: data.oauthSub } })
      : null;

    if (existingBySub) {
      const updated = await this.prisma.user.update({
        where: { id: existingBySub.id },
        data: {
          email: data.email,
          name: data.name,
          avatarUrl: data.avatarUrl ?? existingBySub.avatarUrl,
          oauthProvider: data.oauthProvider,
          oauthSub: data.oauthSub,
        },
      });
      return this.toEntity(updated);
    }

    const existingByEmail = await this.prisma.user.findUnique({ where: { email: data.email } });
    if (existingByEmail) {
      const updated = await this.prisma.user.update({
        where: { id: existingByEmail.id },
        data: {
          name: data.name,
          avatarUrl: data.avatarUrl ?? existingByEmail.avatarUrl,
          oauthProvider: data.oauthProvider,
          oauthSub: data.oauthSub,
        },
      });
      return this.toEntity(updated);
    }

    // Create new user
    const created = await this.prisma.user.create({
      data: {
        email: data.email,
        name: data.name,
        avatarUrl: data.avatarUrl,
        oauthProvider: data.oauthProvider,
        oauthSub: data.oauthSub,
      },
    });
    return this.toEntity(created);
  }

  async findAll(): Promise<User[]> {
    const records = await this.prisma.user.findMany();
    return records.map((r) => this.toEntity(r));
  }

  private toEntity(record: {
    id: string;
    email: string;
    name: string;
    avatarUrl: string | null;
    oauthProvider: string;
    oauthSub: string | null;
    createdAt: Date;
    updatedAt: Date;
  }): User {
    return new User({
      id: record.id,
      email: record.email,
      name: record.name,
      avatarUrl: record.avatarUrl,
      oauthProvider: record.oauthProvider,
      oauthSub: record.oauthSub,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    });
  }
}