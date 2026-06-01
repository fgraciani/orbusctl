import { getTokenSavedAt } from '../core/config.js';
export function checkTokenAge(force) {
    const savedAt = getTokenSavedAt();
    if (!savedAt) {
        // Token came from ORBUS_TOKEN env var — age unknown
        process.stderr.write('Warning: Token age unknown (set via environment variable). It may have expired.\n');
        return;
    }
    const ageMs = Date.now() - new Date(savedAt).getTime();
    const ageMins = Math.floor(ageMs / 60000);
    if (ageMins > 50) {
        const ageStr = ageMins < 60 ? `${ageMins}m` : `${Math.floor(ageMins / 60)}h ${ageMins % 60}m`;
        process.stderr.write(`Warning: Token is ${ageStr} old. It may expire during this operation. Use --force to proceed anyway.\n`);
        if (!force)
            process.exit(1);
    }
}
