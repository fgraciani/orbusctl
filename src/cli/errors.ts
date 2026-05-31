import { ODataError } from '../core/api/client.js';
import { getToken } from '../core/config.js';

export function handleError(err: unknown, json = false): void {
  let message: string;
  let status: number | undefined;

  if (err instanceof ODataError) {
    if (err.isUnauthorized) {
      message = 'Token expired or invalid. Run: orbusctl auth --token <token>';
    } else if (err.isNotFound) {
      message = `Not found: ${err.url}`;
    } else {
      message = `API error: HTTP ${err.status}`;
      status = err.status;
    }
  } else if (err instanceof Error) {
    message = err.message;
  } else {
    message = String(err);
  }

  if (json) {
    const out: { error: string; status?: number } = { error: message };
    if (status !== undefined) out.status = status;
    process.stdout.write(JSON.stringify(out, null, 2) + '\n');
  } else {
    process.stderr.write(`Error: ${message}\n`);
  }
}

export function requireToken(): string {
  const token = getToken();
  if (!token) {
    process.stderr.write('No token saved. Run: orbusctl auth --token <token>\n');
    process.exit(1);
  }
  return token;
}
