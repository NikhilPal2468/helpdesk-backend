/**
 * Storage abstraction: local disk (dev) or Google Cloud Storage (production).
 * When GCS_BUCKET is set, all operations use GCS; otherwise use local paths under storageBase (default .).
 */

import fs from 'fs';
import path from 'path';
import { Readable } from 'stream';
import { Storage } from '@google-cloud/storage';

const bucketName = process.env.GCS_BUCKET;
const storageBase = process.env.STORAGE_BASE || process.cwd();

let gcsClient: Storage | null = null;

function getGcsClient(): Storage {
  if (!gcsClient) {
    gcsClient = new Storage();
  }
  return gcsClient;
}

/** Returns true when GCS_BUCKET is set (use GCS for all storage). */
export function useGcs(): boolean {
  return Boolean(bucketName);
}

/**
 * Upload a buffer to storage. Key is e.g. "uploads/appId/file-123.png" or "pdfs/appId/application-xxx.pdf".
 * Returns the storage key (same as input for GCS; for local, returns relative path).
 */
export async function uploadBuffer(key: string, buffer: Buffer, contentType?: string): Promise<string> {
  if (bucketName) {
    const bucket = getGcsClient().bucket(bucketName);
    const file = bucket.file(key);
    await file.save(buffer, {
      contentType: contentType || 'application/octet-stream',
      metadata: { cacheControl: 'private, max-age=31536000' },
    });
    return key;
  }
  const fullPath = path.join(storageBase, key);
  const dir = path.dirname(fullPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(fullPath, buffer);
  return key;
}

/**
 * Get file contents as Buffer. Key is the stored path (GCS key or local relative/absolute path).
 */
export async function getBuffer(key: string): Promise<Buffer> {
  if (bucketName) {
    const bucket = getGcsClient().bucket(bucketName);
    const [contents] = await bucket.file(key).download();
    return contents;
  }
  // Local: support relative key (storageBase/key) or absolute path (backward compat)
  const fullPath = path.isAbsolute(key) ? key : path.join(storageBase, key);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`File not found: ${key}`);
  }
  return fs.readFileSync(fullPath);
}

/**
 * Get a read stream for the file (for piping to response).
 */
export function getReadStream(key: string): Readable {
  if (bucketName) {
    const bucket = getGcsClient().bucket(bucketName);
    return bucket.file(key).createReadStream();
  }
  const fullPath = path.isAbsolute(key) ? key : path.join(storageBase, key);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`File not found: ${key}`);
  }
  return fs.createReadStream(fullPath);
}

/**
 * Check if a file exists (async for GCS).
 */
export async function exists(key: string): Promise<boolean> {
  if (bucketName) {
    const bucket = getGcsClient().bucket(bucketName);
    const file = bucket.file(key);
    const [exists] = await file.exists();
    return exists;
  }
  const fullPath = path.isAbsolute(key) ? key : path.join(storageBase, key);
  return fs.existsSync(fullPath);
}

/** Synchronous exists for local only; for GCS we need async. */
export function existsSync(key: string): boolean {
  if (bucketName) {
    return false; // caller should use async exists() for GCS
  }
  const fullPath = path.isAbsolute(key) ? key : path.join(storageBase, key);
  return fs.existsSync(fullPath);
}

/**
 * Delete a file by key.
 */
export async function deleteFile(key: string): Promise<void> {
  if (bucketName) {
    const bucket = getGcsClient().bucket(bucketName);
    await bucket.file(key).delete();
    return;
  }
  const fullPath = path.isAbsolute(key) ? key : path.join(storageBase, key);
  if (fs.existsSync(fullPath)) {
    fs.unlinkSync(fullPath);
  }
}

/**
 * Generate a signed URL for temporary GET access (GCS only). Optional for streaming from backend instead.
 */
export async function getSignedUrl(key: string, expiresInMinutes: number = 15): Promise<string> {
  if (!bucketName) {
    throw new Error('Signed URLs only supported with GCS_BUCKET');
  }
  const bucket = getGcsClient().bucket(bucketName);
  const [url] = await bucket.file(key).getSignedUrl({
    version: 'v4',
    action: 'read',
    expires: Date.now() + expiresInMinutes * 60 * 1000,
  });
  return url;
}
