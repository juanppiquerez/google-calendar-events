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
