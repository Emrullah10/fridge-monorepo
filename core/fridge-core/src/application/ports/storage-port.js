/**
 * @typedef {Object} StoragePort
 * @property {(input: { householdId: string, buffer: Buffer, extension: string }) => Promise<{ path: string, bytes: number, sha256: string }>} save
 * @property {(input: { path: string }) => Promise<Buffer>} read
 * @property {(input: { path: string }) => Promise<void>} remove
 */

export {};
