/**
 * WebdisRequester - Transport-layer adapter that lets @upstash/redis talk to a
 * Webdis server.
 *
 * Write your code against `@upstash/redis` as usual; the adapter translates
 * each command into a Webdis REST call and normalises the JSON response back
 * into the `{result, error}` shape the Upstash SDK expects.
 *
 * Usage:
 *   import { Redis } from '@upstash/redis';
 *   import { WebdisRequester } from './webdis-adapter';
 *
 *   const redis = new Redis(new WebdisRequester({ url: 'http://localhost:7379' }));
 *   await redis.set('foo', 'bar');
 *   const value = await redis.get('foo');
 *
 * Or with the convenience factory:
 *   import { createWebdisRedis } from './webdis-adapter';
 *   const redis = createWebdisRedis({ url: 'http://localhost:7379' });
 */

import { Redis } from '@upstash/redis';

type UpstashRequest = {
  path?: string[];
  body?: unknown;
  headers?: Record<string, string>;
  upstashSyncToken?: string;
  onMessage?: (data: string) => void;
  isStreaming?: boolean;
  signal?: AbortSignal;
};

type UpstashResponse<T> = {
  result?: T;
  error?: string;
};

export interface WebdisRequesterConfig {
  /** Base URL of the Webdis server, e.g. "http://localhost:7379". */
  url: string;
  /** Optional HTTP Basic auth credentials if Webdis is configured with them. */
  auth?: { user: string; password: string };
  /** Optional fetch override (useful for tests / non-global environments). */
  fetch?: typeof fetch;
}

export class WebdisRequester {
  private baseUrl: string;
  private auth?: { user: string; password: string };
  private fetchImpl: typeof fetch;

  // Fields required by @upstash/redis's Requester interface.
  readYourWrites: boolean = false;
  upstashSyncToken: string = '';

  constructor(config: WebdisRequesterConfig) {
    this.baseUrl = config.url.replace(/\/$/, '');
    this.auth = config.auth;
    this.fetchImpl = config.fetch ?? fetch;
  }

  /** No-op telemetry hook — Webdis has no equivalent headers. */
  mergeTelemetry(_: { runtime?: string; platform?: string; sdk?: string }): void {}

  async request<TResult = unknown>(req: UpstashRequest): Promise<UpstashResponse<TResult>> {
    const body = req.body;
    if (!Array.isArray(body) || body.length === 0) {
      return { error: 'WebdisRequester: expected req.body to be a non-empty command array' };
    }

    if (req.isStreaming) {
      return { error: 'WebdisRequester: streaming commands (SUBSCRIBE/MONITOR) are not supported' };
    }

    const parts = body.map((v) => String(v));
    // Webdis keys responses by the uppercased first path segment.
    const cmd = parts[0].toUpperCase();
    const args = parts.slice(1).map(encodeURIComponent);
    const url = `${this.baseUrl}/${cmd}${args.length ? '/' + args.join('/') : ''}`;

    const headers: Record<string, string> = { ...(req.headers ?? {}) };
    if (this.auth) {
      const creds = `${this.auth.user}:${this.auth.password}`;
      headers.Authorization = `Basic ${btoa(creds)}`;
    }

    let res: Response;
    try {
      res = await this.fetchImpl(url, { method: 'GET', headers, signal: req.signal });
    } catch (err) {
      return { error: err instanceof Error ? err.message : String(err) };
    }

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      return { error: `Webdis HTTP ${res.status}: ${text || res.statusText}` };
    }

    let data: Record<string, unknown>;
    try {
      data = (await res.json()) as Record<string, unknown>;
    } catch (err) {
      return { error: `Webdis returned invalid JSON: ${err instanceof Error ? err.message : String(err)}` };
    }

    const raw = data[cmd];

    // Webdis wraps simple-string replies and errors as [status, value]:
    //   SET → {"SET": [true, "OK"]}
    //   PING → {"PING": [true, "PONG"]}
    //   error → {"CMD": [false, "err message"]}
    // Bulk/integer/array replies are returned unwrapped.
    if (Array.isArray(raw) && raw.length === 2 && typeof raw[0] === 'boolean') {
      const [ok, value] = raw;
      if (ok === false) {
        return { error: typeof value === 'string' ? value : JSON.stringify(value) };
      }
      return { result: value as TResult };
    }

    return { result: raw as TResult };
  }
}

/**
 * Convenience factory: returns an `@upstash/redis` `Redis` client wired up to
 * talk to a Webdis server via `WebdisRequester`.
 */
export function createWebdisRedis(config: WebdisRequesterConfig): Redis {
  return new Redis(new WebdisRequester(config));
}
