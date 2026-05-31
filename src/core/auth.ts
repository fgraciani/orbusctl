import { scryptSync, randomBytes, timingSafeEqual } from 'node:crypto';
import { getWritePasswordHash, getWritePasswordSalt, isWritePasswordExpired } from './config.js';

export function hashPassword(password: string): { hash: string; salt: string } {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return { hash, salt };
}

export function verifyWritePassword(password: string): 'ok' | 'expired' | 'invalid' | 'not-set' {
  const storedHash = getWritePasswordHash();
  const storedSalt = getWritePasswordSalt();
  if (!storedHash || !storedSalt) return 'not-set';
  if (isWritePasswordExpired()) return 'expired';
  const hash = scryptSync(password, storedSalt, 64);
  const valid = timingSafeEqual(hash, Buffer.from(storedHash, 'hex'));
  return valid ? 'ok' : 'invalid';
}
