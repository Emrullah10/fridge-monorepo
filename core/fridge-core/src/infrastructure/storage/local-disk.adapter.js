import { mkdir, writeFile, readFile, unlink } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import crypto from 'node:crypto';

const makeLocalDiskStorage = ({ baseDir }) => {
  return {
    save: async ({ householdId, buffer, extension }) => {
      const now = new Date();
      const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      const fileName = `${crypto.randomUUID()}.${extension}`;
      const relativePath = join(householdId, yearMonth, fileName);
      const absolutePath = join(baseDir, relativePath);

      await mkdir(dirname(absolutePath), { recursive: true });
      await writeFile(absolutePath, buffer);

      return {
        path: relativePath,
        bytes: buffer.length,
        sha256: crypto.createHash('sha256').update(buffer).digest('hex'),
      };
    },

    read: async ({ path }) => readFile(join(baseDir, path)),

    remove: async ({ path }) => {
      try {
        await unlink(join(baseDir, path));
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
      }
    },
  };
};

export { makeLocalDiskStorage };
