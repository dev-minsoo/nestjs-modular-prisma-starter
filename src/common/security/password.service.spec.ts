import { PasswordService } from './password.service';

describe('PasswordService', () => {
  let service: PasswordService;

  beforeEach(() => {
    service = new PasswordService();
  });

  it('hashes and compares passwords', async () => {
    const passwordHash = await service.hash('strong-password');

    expect(passwordHash).not.toBe('strong-password');
    await expect(
      service.compare('strong-password', passwordHash),
    ).resolves.toBe(true);
    await expect(service.compare('wrong-password', passwordHash)).resolves.toBe(
      false,
    );
  });
});
