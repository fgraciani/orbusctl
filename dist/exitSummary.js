import { getSessionSummary } from './core/api/counter.js';
import { VERSION } from './version.js';
const G = '\x1b[90m';
const C = '\x1b[36m';
const GR = '\x1b[32m';
const W = '\x1b[37m';
const B = '\x1b[1m';
const R = '\x1b[0m';
const SAGE = '\x1b[38;2;108;184;134m';
function dur(start) {
    const secs = Math.floor((Date.now() - start.getTime()) / 1000);
    if (secs < 60)
        return `${secs}s`;
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    if (m < 60)
        return s > 0 ? `${m}m ${s}s` : `${m}m`;
    const h = Math.floor(m / 60);
    const rm = m % 60;
    return rm > 0 ? `${h}h ${rm}m` : `${h}h`;
}
export function printExitSummary(sessionStart, tokensUsed, user) {
    const s = getSessionSummary();
    const d = dur(sessionStart);
    const userTotal = Object.values(s.userByMethod).reduce((a, b) => a + b, 0);
    const tokenStr = tokensUsed > 1 ? `${tokensUsed} (${tokensUsed - 1} refresh${tokensUsed > 2 ? 'es' : ''})` : '1';
    const w = Math.min(process.stdout.columns || 80, 72);
    const inner = w - 2;
    // Row helper: takes raw string (for length calc) and styled string
    const row = (raw, styled) => {
        const p = Math.max(0, inner - raw.length);
        console.log(`${G}│${R}${styled}${' '.repeat(p)}${G}│${R}`);
    };
    const blank = () => row('', '');
    const lw = 36;
    const rCol = inner - 2;
    const apiCol = lw;
    const apiRow = (label, value, labelColor, valueColor, indent = 0) => {
        const prefix = ' '.repeat(apiCol + indent);
        const valStr = String(value);
        const gap = Math.max(2, rCol - apiCol - indent - label.length - valStr.length);
        const raw = prefix + label + ' '.repeat(gap) + valStr;
        const styled = prefix + `${labelColor}${label}${R}` + ' '.repeat(gap) + `${valueColor}${valStr}${R}`;
        row(raw, styled);
    };
    // Two-col row: left label+value at fixed positions, right label+value
    const dualRow = (lLabel, lValue, rLabel, rValue, rLabelColor, rValueColor) => {
        const left = `  ${lLabel}${' '.repeat(Math.max(2, 14 - lLabel.length))}${lValue}`;
        const leftStyled = `  ${G}${lLabel}${R}${' '.repeat(Math.max(2, 14 - lLabel.length))}${W}${lValue}${R}`;
        const leftPad = ' '.repeat(Math.max(0, apiCol - left.length));
        const rValStr = String(rValue);
        const gap = Math.max(2, rCol - apiCol - rLabel.length - rValStr.length);
        const raw = left + leftPad + rLabel + ' '.repeat(gap) + rValStr;
        const styled = leftStyled + leftPad + `${rLabelColor}${rLabel}${R}` + ' '.repeat(gap) + `${rValueColor}${rValStr}${R}`;
        row(raw, styled);
    };
    const tl = `─ ORBUSCTL v${VERSION} `;
    const tr = ' Session Summary ─';
    const fill = Math.max(0, inner - tl.length - tr.length);
    process.stdout.write('\x1b[2J\x1b[H');
    console.log(`${G}╭─${R} ${B}${C}ORBUSCTL${R} ${G}v${VERSION} ${'─'.repeat(fill)} ${R}${W}Session Summary${R} ${G}─╮${R}`);
    blank();
    const startStr = sessionStart.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    const endStr = new Date().toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    dualRow('Duration', d, 'Calls (total)', String(s.total), G, W);
    dualRow('Start', startStr, 'Startup', String(s.startup), G, G);
    dualRow('End', endStr, 'Heartbeat', String(s.heartbeat), G, G);
    dualRow('Tokens', tokenStr, 'User', String(userTotal), G, W);
    for (const [m, n] of Object.entries(s.userByMethod)) {
        if (n > 0)
            apiRow(m, String(n), SAGE, SAGE, 2);
    }
    blank();
    row(`  Goodbye${user ? `, ${user}` : ''}!`, `  ${GR}Goodbye${user ? `, ${user}` : ''}!${R}`);
    blank();
    console.log(`${G}╰${'─'.repeat(inner)}╯${R}`);
    console.log();
}
