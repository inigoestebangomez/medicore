// apps/api/src/infrastructure/email/console-email.service.spec.ts
import { ConsoleEmailService } from './console-email.service';

describe('ConsoleEmailService', () => {
  let service: ConsoleEmailService;
  let consoleSpy:jest.SpyInstance;

  beforeEach(() => {
    service = new ConsoleEmailService();
    consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  it('should log invitation email to console', async () => {
    await service.sendInvitation({
      to: 'test@example.com',
      organizationName: 'Test Org',
      acceptUrl: 'https://app.medicore.com/invitations/accept?token=abc123',
      role: 'PHYSICIAN',
    });
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('test@example.com'),
    );
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('Test Org'),
    );
  });

  it('should log welcome email to console', async () => {
    await service.sendWelcome({
      to: 'new@example.com',
      userName: 'New User',
      organizationName: 'Test Org',
    });
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('New User'),
    );
  });
});