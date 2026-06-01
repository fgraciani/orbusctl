import { recordCall, isStartupComplete } from './counter.js';
let currentCategory = 'startup';
export function setCallCategory(cat) {
    currentCategory = cat;
}
import { getServer } from '../config.js';
export function getBaseUrl() {
    return getServer();
}
export const PAGE_SIZE = 50;
export function escapeODataString(value) {
    return value.replace(/'/g, "''");
}
export function authHeaders(token) {
    return { Authorization: `Bearer ${token}` };
}
async function trackedFetch(url, init) {
    const method = (init?.method ?? 'GET').toUpperCase();
    const start = Date.now();
    let status = 0;
    try {
        const response = await fetch(url, init);
        status = response.status;
        return response;
    }
    catch (e) {
        status = 0;
        throw e;
    }
    finally {
        const category = isStartupComplete() ? currentCategory : 'startup';
        recordCall({ method, timestamp: start, status, latencyMs: Date.now() - start, url, category });
    }
}
export async function odata(token, url) {
    const response = await trackedFetch(url, { headers: authHeaders(token) });
    if (!response.ok) {
        throw new ODataError(`HTTP ${response.status}`, response.status, url);
    }
    return response.json();
}
export async function odataList(token, url) {
    const all = [];
    let skip = 0;
    const separator = url.includes('?') ? '&' : '?';
    for (;;) {
        const pageUrl = `${url}${separator}$top=${PAGE_SIZE}&$skip=${skip}`;
        const data = await odata(token, pageUrl);
        all.push(...data.value);
        if (data.value.length < PAGE_SIZE)
            break;
        skip += PAGE_SIZE;
    }
    return all;
}
export async function odataCount(token, entity, modelId) {
    const data = await odata(token, `${getBaseUrl()}/odata/${entity}?$filter=ModelId eq ${modelId}&$count=true&$top=0`);
    return data['@odata.count'];
}
export async function odataDelete(token, url) {
    const response = await trackedFetch(url, {
        method: 'DELETE',
        headers: authHeaders(token),
    });
    if (!response.ok)
        throw new ODataError(`HTTP ${response.status}`, response.status, url);
}
export async function odataPost(token, url, body) {
    const response = await trackedFetch(url, {
        method: 'POST',
        headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    if (!response.ok)
        throw new ODataError(`HTTP ${response.status}`, response.status, url);
    return response.json();
}
export async function odataPatch(token, url, body) {
    const response = await trackedFetch(url, {
        method: 'PATCH',
        headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    if (!response.ok)
        throw new ODataError(`HTTP ${response.status}`, response.status, url);
    return response.json();
}
export class ODataError extends Error {
    constructor(message, status, url) {
        super(message);
        this.status = status;
        this.url = url;
        this.name = 'ODataError';
    }
    get isUnauthorized() { return this.status === 401 || this.status === 403; }
    get isNotFound() { return this.status === 404; }
}
