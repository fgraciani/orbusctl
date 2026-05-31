import { getServer, getBrowser } from './config.js';

export function getOrbusObjectUrl(objectId: string): string {
  const server = getServer();
  const browserUrl = server.replace('-api.', '.');
  return `${browserUrl}/object/${objectId}/details`;
}

export function getOrbusDrawingUrl(drawingId: string): string {
  const server = getServer();
  const browserUrl = server.replace('-api.', '.');
  return `${browserUrl}/draw/${drawingId}`;
}

export async function openFile(filePath: string): Promise<void> {
  const { exec } = await import('node:child_process');
  const platform = process.platform;
  const cmd = platform === 'darwin'
    ? `open "${filePath}"`
    : platform === 'win32'
      ? `start "" "${filePath}"`
      : `xdg-open "${filePath}"`;
  exec(cmd);
}

export async function openInBrowser(url: string): Promise<void> {
  const browser = getBrowser();
  const { exec } = await import('node:child_process');
  const platform = process.platform;

  let cmd: string;
  if (browser) {
    cmd = platform === 'darwin'
      ? `open -a "${browser}" "${url}"`
      : `"${browser}" "${url}"`;
  } else {
    cmd = platform === 'darwin'
      ? `open "${url}"`
      : platform === 'win32'
        ? `start "${url}"`
        : `xdg-open "${url}"`;
  }

  exec(cmd);
}
