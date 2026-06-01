import { existsSync, mkdirSync, readFileSync, writeFileSync, chmodSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
const CONFIG_DIR = join(homedir(), '.orbusctl');
const CONFIG_FILE = join(CONFIG_DIR, 'config.json');
const REPORTS_DIR = join(CONFIG_DIR, 'reports');
const EXPORTS_DIR = join(CONFIG_DIR, 'exports');
const TEMPLATES_DIR = join(CONFIG_DIR, 'templates');
const DEFAULT_SOLUTION_FILTER = 'ArchiMate 3.1';
const DEFAULT_SERVER = 'https://eurocontrol-api.iserver365.com';
function readConfig() {
    if (!existsSync(CONFIG_FILE))
        return {};
    try {
        return JSON.parse(readFileSync(CONFIG_FILE, 'utf-8'));
    }
    catch {
        return {};
    }
}
function writeConfig(config) {
    if (!existsSync(CONFIG_DIR)) {
        mkdirSync(CONFIG_DIR, { recursive: true });
    }
    writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2) + '\n', { mode: 0o600 });
    chmodSync(CONFIG_FILE, 0o600);
}
export function getServer() {
    return readConfig().server ?? DEFAULT_SERVER;
}
export function getOrgName() {
    const server = getServer();
    const match = server.match(/https?:\/\/(.+)-api\.iserver365\.com/);
    return match ? match[1].toUpperCase() : server;
}
export function saveServer(server) {
    const config = readConfig();
    config.server = server.replace(/\/+$/, '');
    writeConfig(config);
}
export function getToken() {
    return process.env.ORBUS_TOKEN ?? readConfig().token;
}
export function getUser() {
    return readConfig().user;
}
export function getShowHiddenModels() {
    return readConfig().showHiddenModels ?? false;
}
export function saveShowHiddenModels(show) {
    const config = readConfig();
    config.showHiddenModels = show;
    writeConfig(config);
}
export function getSolutionFilter() {
    const value = readConfig().solutionFilter;
    if (value === '')
        return undefined;
    return value ?? DEFAULT_SOLUTION_FILTER;
}
export function saveSolutionFilter(solutionFilter) {
    const config = readConfig();
    config.solutionFilter = solutionFilter ?? '';
    writeConfig(config);
}
export function getBannerColor() {
    return readConfig().bannerColor;
}
export function saveBannerColor(color) {
    const config = readConfig();
    if (color === undefined) {
        delete config.bannerColor;
    }
    else {
        config.bannerColor = color;
    }
    writeConfig(config);
}
export function resetSettings() {
    const config = readConfig();
    delete config.bannerColor;
    delete config.showHiddenModels;
    delete config.solutionFilter;
    writeConfig(config);
}
export function getTokenSavedAt() {
    return readConfig().tokenSavedAt;
}
export function formatTokenAge() {
    const saved = readConfig().tokenSavedAt;
    if (!saved)
        return null;
    const ms = Date.now() - new Date(saved).getTime();
    if (ms < 0)
        return null;
    const mins = Math.floor(ms / 60000);
    if (mins < 1)
        return 'just now';
    if (mins < 60)
        return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    const rm = mins % 60;
    return rm > 0 ? `${hrs}h ${rm}m` : `${hrs}h`;
}
export function hasToken() {
    return !!readConfig().token;
}
export function saveAuth(token, user) {
    const config = readConfig();
    config.token = token;
    config.tokenSavedAt = new Date().toISOString();
    config.user = user;
    writeConfig(config);
}
export function saveWritePassword(hash, salt) {
    const config = readConfig();
    config.writePasswordHash = hash;
    config.writePasswordSalt = salt;
    config.writePasswordSetAt = new Date().toISOString();
    writeConfig(config);
}
export function getWritePasswordHash() {
    return readConfig().writePasswordHash;
}
export function getWritePasswordSalt() {
    return readConfig().writePasswordSalt;
}
export function getWritePasswordSetAt() {
    return readConfig().writePasswordSetAt;
}
export function isWritePasswordExpired() {
    const setAt = readConfig().writePasswordSetAt;
    if (!setAt)
        return true;
    return Date.now() - new Date(setAt).getTime() > 24 * 60 * 60 * 1000;
}
export function clearWritePassword() {
    const config = readConfig();
    delete config.writePasswordHash;
    delete config.writePasswordSalt;
    delete config.writePasswordSetAt;
    writeConfig(config);
}
export function getBrowser() {
    return readConfig().browser;
}
export function saveBrowser(browser) {
    const config = readConfig();
    if (browser === undefined) {
        delete config.browser;
    }
    else {
        config.browser = browser;
    }
    writeConfig(config);
}
export function getReportsDir() {
    if (!existsSync(REPORTS_DIR)) {
        mkdirSync(REPORTS_DIR, { recursive: true });
    }
    return REPORTS_DIR;
}
export function getExportsDir() {
    if (!existsSync(EXPORTS_DIR)) {
        mkdirSync(EXPORTS_DIR, { recursive: true });
    }
    return EXPORTS_DIR;
}
export function getTemplatesDir() {
    if (!existsSync(TEMPLATES_DIR)) {
        mkdirSync(TEMPLATES_DIR, { recursive: true });
    }
    return TEMPLATES_DIR;
}
