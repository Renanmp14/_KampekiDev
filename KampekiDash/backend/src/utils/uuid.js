import { randomUUID } from 'crypto';

// Geração de UUID v4 (nativo do Node 14.17+)
export function newUuid() {
  return randomUUID();
}
