import { verifyWritePassword } from '../core/auth.js';
export function requireWriteAccess(password) {
    if (!password) {
        process.stderr.write('Error: Write operations require --password. Set a write password in the TUI Config section first.\n');
        process.exit(1);
    }
    const result = verifyWritePassword(password);
    if (result === 'not-set') {
        process.stderr.write('Error: No write password configured. Set one in the TUI Config section.\n');
        process.exit(1);
    }
    if (result === 'expired') {
        process.stderr.write('Error: Write password expired (>24h). Renew it in the TUI Config section.\n');
        process.exit(1);
    }
    if (result === 'invalid') {
        process.stderr.write('Error: Invalid write password.\n');
        process.exit(1);
    }
}
