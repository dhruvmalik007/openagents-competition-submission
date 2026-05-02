import { list, put } from '@vercel/blob';
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { env } from './env';
import { getDataRoot } from './paths';

export async function writeArtifact(path: string, payload: string): Promise<string> {
  if (env.blobConfigured) {
    const blob = await put(path, payload, {
      access: 'public',
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: 'application/json'
    });
    return blob.url;
  }

  const target = join(getDataRoot(), path);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, payload, 'utf8');
  return target;
}

export async function readArtifact(path: string): Promise<string | null> {
  const localTarget = join(getDataRoot(), path);
  try {
    return readFileSync(localTarget, 'utf8');
  } catch {
    if (!env.blobConfigured) return null;
    try {
      const { blobs } = await list({ prefix: path });
      const exactMatch = blobs.find((blob) => blob.pathname === path) ?? blobs[0];
      if (!exactMatch) return null;
      const response = await fetch(exactMatch.url);
      if (!response.ok) return null;
      return response.text();
    } catch {
      return null;
    }
  }
}

export async function listArtifacts(prefix: string): Promise<string[]> {
  if (env.blobConfigured) {
    try {
      const { blobs } = await list({ prefix });
      return blobs.map((blob) => blob.pathname);
    } catch {
      return [];
    }
  }

  const root = join(getDataRoot(), prefix);
  try {
    return readdirSync(root).map((entry) => join(prefix, entry));
  } catch {
    return [];
  }
}
