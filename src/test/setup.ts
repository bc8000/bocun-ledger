import 'fake-indexeddb/auto';
import { afterEach } from 'vitest';
import { resetDatabase } from '../storage/db';

afterEach(async () => {
  await resetDatabase();
});
