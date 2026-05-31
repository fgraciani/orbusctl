import { recordCall, isStartupComplete, type CallCategory } from './counter.js';

let currentCategory: CallCategory = 'startup';

export function setCallCategory(cat: CallCategory): void {
  currentCategory = cat;
}

import { getServer } from '../config.js';

export function getBaseUrl(): string {
  return getServer();
}

export const PAGE_SIZE = 50;

export function escapeODataString(value: string): string {
  return value.replace(/'/g, "''");
}

export function authHeaders(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` };
}

async function trackedFetch(url: string, init?: RequestInit): Promise<Response> {
  const method = (init?.method ?? 'GET').toUpperCase();
  const start = Date.now();
  let status = 0;
  try {
    const response = await fetch(url, init);
    status = response.status;
    return response;
  } catch (e) {
    status = 0;
    throw e;
  } finally {
    const category = isStartupComplete() ? currentCategory : 'startup';
    recordCall({ method, timestamp: start, status, latencyMs: Date.now() - start, url, category });
  }
}

export async function odata<T>(token: string, url: string): Promise<T> {
  const response = await trackedFetch(url, { headers: authHeaders(token) });
  if (!response.ok) {
    throw new ODataError(`HTTP ${response.status}`, response.status, url);
  }
  return response.json() as Promise<T>;
}

interface ODataListResponse<T> { value: T[] }

export async function odataList<T>(token: string, url: string): Promise<T[]> {
  const all: T[] = [];
  let skip = 0;
  const separator = url.includes('?') ? '&' : '?';

  for (;;) {
    const pageUrl = `${url}${separator}$top=${PAGE_SIZE}&$skip=${skip}`;
    const data = await odata<ODataListResponse<T>>(token, pageUrl);
    all.push(...data.value);
    if (data.value.length < PAGE_SIZE) break;
    skip += PAGE_SIZE;
  }

  return all;
}

interface CountResponse { '@odata.count': number }

export async function odataCount(token: string, entity: string, modelId: string): Promise<number> {
  const data = await odata<CountResponse>(
    token,
    `${getBaseUrl()}/odata/${entity}?$filter=ModelId eq ${modelId}&$count=true&$top=0`,
  );
  return data['@odata.count'];
}

export async function odataDelete(token: string, url: string): Promise<void> {
  const response = await trackedFetch(url, {
    method: 'DELETE',
    headers: authHeaders(token),
  });
  if (!response.ok) throw new ODataError(`HTTP ${response.status}`, response.status, url);
}

export async function odataPost<T>(token: string, url: string, body: unknown): Promise<T> {
  const response = await trackedFetch(url, {
    method: 'POST',
    headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new ODataError(`HTTP ${response.status}`, response.status, url);
  return response.json() as Promise<T>;
}

export async function odataPatch<T>(token: string, url: string, body: unknown): Promise<T> {
  const response = await trackedFetch(url, {
    method: 'PATCH',
    headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new ODataError(`HTTP ${response.status}`, response.status, url);
  return response.json() as Promise<T>;
}

export class ODataError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly url: string,
  ) {
    super(message);
    this.name = 'ODataError';
  }

  get isUnauthorized(): boolean { return this.status === 401 || this.status === 403; }
  get isNotFound(): boolean { return this.status === 404; }
}
