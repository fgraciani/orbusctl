import { ODataError } from '../core/api/client.js';
import { getToken } from '../core/config.js';
export function handleError(err, json = false) {
    let message;
    let status;
    if (err instanceof ODataError) {
        if (err.isUnauthorized) {
            message = 'Token expired or invalid. Run: orbusctl auth --token <token>';
        }
        else if (err.isNotFound) {
            message = `Not found: ${err.url}`;
        }
        else {
            message = `API error: HTTP ${err.status}`;
            status = err.status;
        }
    }
    else if (err instanceof Error) {
        message = err.message;
    }
    else {
        message = String(err);
    }
    if (json) {
        const out = { error: message };
        if (status !== undefined)
            out.status = status;
        process.stdout.write(JSON.stringify(out, null, 2) + '\n');
    }
    else {
        process.stderr.write(`Error: ${message}\n`);
    }
}
export function requireToken() {
    const token = getToken();
    if (!token) {
        process.stderr.write('No token saved. Run: orbusctl auth --token <token>\n');
        process.exit(1);
    }
    return token;
}
