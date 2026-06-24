import { Test, TestingModule } from '@nestjs/testing';
import { EncryptionService } from './encryption.service';

describe('EncryptionService', () => {
  let service: EncryptionService;

  const TEST_KEY = 'a'.repeat(64);

  beforeEach(async () => {
    process.env.ENCRYPTION_KEY = TEST_KEY;

    const module: TestingModule = await Test.createTestingModule({
      providers: [EncryptionService],
    }).compile();

    service = module.get(EncryptionService);
    service.onModuleInit();
  });

  it('decrypt(encrypt(x)) returns x', () => {
    const plaintext = 'super-secret-refresh-token-value';
    const ciphertext = service.encrypt(plaintext);
    expect(service.decrypt(ciphertext)).toBe(plaintext);
  });

  it('produces different ciphertexts for the same plaintext (unique IV)', () => {
    const plaintext = 'same-value';
    const first = service.encrypt(plaintext);
    const second = service.encrypt(plaintext);

    expect(first).not.toBe(second);
    expect(service.decrypt(first)).toBe(plaintext);
    expect(service.decrypt(second)).toBe(plaintext);
  });
});

describe('EncryptionService error paths', () => {
  it('throws when ENCRYPTION_KEY is missing', async () => {
    delete process.env.ENCRYPTION_KEY;

    const module = await Test.createTestingModule({
      providers: [EncryptionService],
    }).compile();

    const svc = module.get(EncryptionService);
    expect(() => svc.onModuleInit()).toThrow(
      'ENCRYPTION_KEY environment variable is required',
    );
  });

  it('throws when ENCRYPTION_KEY is not 32 bytes', async () => {
    process.env.ENCRYPTION_KEY = 'abcd';

    const module = await Test.createTestingModule({
      providers: [EncryptionService],
    }).compile();

    const svc = module.get(EncryptionService);
    expect(() => svc.onModuleInit()).toThrow(
      'ENCRYPTION_KEY must be a 32-byte value encoded as 64 hex characters',
    );
  });

  it('throws on malformed ciphertext format', async () => {
    process.env.ENCRYPTION_KEY = 'a'.repeat(64);

    const module = await Test.createTestingModule({
      providers: [EncryptionService],
    }).compile();

    const svc = module.get(EncryptionService);
    svc.onModuleInit();

    expect(() => svc.decrypt('not-valid-ciphertext')).toThrow(
      'Invalid ciphertext format',
    );
  });

  it('throws when decrypting tampered ciphertext', async () => {
    process.env.ENCRYPTION_KEY = 'a'.repeat(64);

    const module = await Test.createTestingModule({
      providers: [EncryptionService],
    }).compile();

    const svc = module.get(EncryptionService);
    svc.onModuleInit();

    const ciphertext = svc.encrypt('secret');
    const parts = ciphertext.split(':');
    parts[2] = `${parts[2]}ff`;
    const tampered = parts.join(':');

    expect(() => svc.decrypt(tampered)).toThrow();
  });
});
