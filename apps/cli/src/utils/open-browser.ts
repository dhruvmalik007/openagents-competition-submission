import { exec } from 'node:child_process';
import { platform } from 'node:os';

export function openBrowser(url: string): Promise<void> {
  const command =
    platform() === 'darwin'
      ? `open "${url}"`
      : platform() === 'win32'
        ? `start "" "${url}"`
        : `xdg-open "${url}"`;

  return new Promise((resolve, reject) => {
    exec(command, (error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}