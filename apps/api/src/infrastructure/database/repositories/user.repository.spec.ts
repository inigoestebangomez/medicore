// apps/api/src/infrastructure/database/repositories/user.repository.spec.ts
import { PrismaUserRepository } from './user.repository';
import { User } from '@/domain/user/user.entity';

// Mock PrismaService
const mockPrisma = {
  user: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
};

describe('PrismaUserRepository', () => {
  let repository: PrismaUserRepository;

  beforeEach(() => {
    repository = new PrismaUserRepository(mockPrisma as any);
    jest.clearAllMocks();
  });

  const dbUser = {
    id: 'user-1',
    email: 'test@example.com',
    name: 'Test User',
    avatarUrl: null,
    oauthProvider: 'google',
    oauthSub: 'google-123',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-02'),
  };

  describe('findById', () => {
    it('should return User entity when found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(dbUser);
      const result = await repository.findById('user-1');
      expect(result).toBeInstanceOf(User);
      expect(result?.id).toBe('user-1');
      expect(result?.email).toBe('test@example.com');
    });

    it('should return null when not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      const result = await repository.findById('nonexistent');
      expect(result).toBeNull();
    });
  });

  describe('findByEmail', () => {
    it('should return User entity when found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(dbUser);
      const result = await repository.findByEmail('test@example.com');
      expect(result?.email).toBe('test@example.com');
    });

    it('should return null when not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      const result = await repository.findByEmail('nobody@example.com');
      expect(result).toBeNull();
    });
  });

  describe('findByOAuthSub', () => {
    it('should return User entity when found', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(dbUser);
      const result = await repository.findByOAuthSub('google-123');
      expect(result?.oauthSub).toBe('google-123');
    });

    it('should return null when not found', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);
      const result = await repository.findByOAuthSub('nonexistent');
      expect(result).toBeNull();
    });
  });

  describe('upsert', () => {
    it('should update existing user by oauthSub', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(dbUser);
      mockPrisma.user.update.mockResolvedValue({ ...dbUser, name: 'Updated Name' });

      const result = await repository.upsert({
        email: 'test@example.com',
        name: 'Updated Name',
        oauthProvider: 'google',
        oauthSub: 'google-123',
      });

      expect(result.name).toBe('Updated Name');
      expect(mockPrisma.user.update).toHaveBeenCalled();
    });

    it('should update existing user by email if not found by sub', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);
      mockPrisma.user.findUnique.mockResolvedValue(dbUser);
      mockPrisma.user.update.mockResolvedValue({ ...dbUser, oauthSub: 'google-new' });

      const result = await repository.upsert({
        email: 'test@example.com',
        name: 'Test User',
        oauthProvider: 'google',
        oauthSub: 'google-new',
      });

      expect(result.oauthSub).toBe('google-new');
    });

    it('should create a new user when neither sub nor email exist', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue(dbUser);

      const result = await repository.upsert({
        email: 'new@example.com',
        name: 'New User',
        oauthProvider: 'google',
        oauthSub: 'google-new',
      });

      expect(result).toBeInstanceOf(User);
      expect(mockPrisma.user.create).toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('should return all users as entities', async () => {
      mockPrisma.user.findMany.mockResolvedValue([dbUser]);
      const result = await repository.findAll();
      expect(result).toHaveLength(1);
      expect(result[0]).toBeInstanceOf(User);
    });
  });
});