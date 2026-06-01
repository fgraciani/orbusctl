import { jsx as _jsx } from "react/jsx-runtime";
import { render } from 'ink';
import { App } from './index.js';
import { printExitSummary } from './exitSummary.js';
let exitData = null;
function storeExitData(sessionStart, tokensUsed, user) {
    exitData = { sessionStart, tokensUsed, user };
}
const BG = '#0E2A35';
const OSC_SET_BG = `\x1b]11;${BG}\x07`;
const OSC_RESET_BG = '\x1b]111\x07';
process.stdout.write(OSC_SET_BG);
const cleanup = () => {
    process.stdout.write(OSC_RESET_BG);
    if (exitData)
        printExitSummary(exitData.sessionStart, exitData.tokensUsed, exitData.user);
};
process.on('exit', cleanup);
process.on('SIGINT', () => { process.stdout.write(OSC_RESET_BG); process.exit(0); });
process.on('SIGTERM', () => { process.stdout.write(OSC_RESET_BG); process.exit(0); });
render(_jsx(App, { onStoreExitData: storeExitData }));
