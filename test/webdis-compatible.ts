/**
 * WebdisRedis - A drop-in replacement for Upstash Redis that uses Webdis
 * 
 * This class wraps Webdis's REST API to provide the same interface as @upstash/redis
 * so you can swap between Upstash, SRH, and Webdis without changing your code.
 */
export class WebdisRedis {
  private baseUrl: string;
  
  constructor(config: { url: string; token?: string }) {
    this.baseUrl = config.url.replace(/\/$/, '');
  }
  
  private async exec<T>(cmd: string, ...args: (string | number)[]): Promise<T> {
    const encodedArgs = args.map(arg => encodeURIComponent(String(arg)));
    const url = encodedArgs.length > 0 
      ? `${this.baseUrl}/${cmd}/${encodedArgs.join('/')}` 
      : `${this.baseUrl}/${cmd}`;
    
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
    
    const data = await res.json();
    const result = data[cmd.toUpperCase()];
    if (!result) return null as T;
    
    if (Array.isArray(result) && result.length === 2) {
      const [status, value] = result;
      if (status === false) throw new Error(value);
      return value as T;
    }
    return result as T;
  }
  
  async ping(): Promise<string> {
    return this.exec<string>('PING');
  }
  
  async set(key: string, value: string | number | object, opts?: { ex?: number; px?: number; nx?: boolean; xx?: boolean }): Promise<'OK' | null> {
    if (typeof value === 'object') value = JSON.stringify(value);
    const args: (string | number)[] = [key, String(value)];
    if (opts?.ex) args.push('EX', opts.ex);
    if (opts?.px) args.push('PX', opts.px);
    if (opts?.nx) args.push('NX');
    if (opts?.xx) args.push('XX');
    return this.exec<'OK'>('SET', ...args);
  }
  
  async get<T = string>(key: string): Promise<T | null> {
    const value = await this.exec<string>('GET', key);
    if (!value) return null;
    try { return JSON.parse(value) as T; } catch { return value as unknown as T; }
  }
  
  async mget<T = string>(...keys: string[]): Promise<(T | null)[]> {
    const values = await this.exec<string[]>('MGET', ...keys);
    if (!values) return keys.map(() => null);
    return values.map(v => {
      if (!v) return null;
      try { return JSON.parse(v) as T; } catch { return v as unknown as T; }
    });
  }
  
  async mset(kv: Record<string, string | number>): Promise<'OK'> {
    const args: (string | number)[] = [];
    for (const [k, v] of Object.entries(kv)) args.push(k, String(v));
    return this.exec<'OK'>('MSET', ...args);
  }
  
  async del(...keys: string[]): Promise<number> {
    return this.exec<number>('DEL', ...keys);
  }
  
  async exists(...keys: string[]): Promise<number> {
    return this.exec<number>('EXISTS', ...keys);
  }
  
  async expire(key: string, seconds: number): Promise<number> {
    return this.exec<number>('EXPIRE', key, seconds);
  }
  
  async ttl(key: string): Promise<number> {
    return this.exec<number>('TTL', key);
  }
  
  async incr(key: string): Promise<number> {
    return this.exec<number>('INCR', key);
  }
  
  async incrby(key: string, increment: number): Promise<number> {
    return this.exec<number>('INCRBY', key, increment);
  }
  
  async decr(key: string): Promise<number> {
    return this.exec<number>('DECR', key);
  }
  
  async decrby(key: string, decrement: number): Promise<number> {
    return this.exec<number>('DECRBY', key, decrement);
  }
  
  async lpush(key: string, ...values: (string | number)[]): Promise<number> {
    return this.exec<number>('LPUSH', key, ...values.map(String));
  }
  
  async rpush(key: string, ...values: (string | number)[]): Promise<number> {
    return this.exec<number>('RPUSH', key, ...values.map(String));
  }
  
  async lrange<T = string>(key: string, start: number, stop: number): Promise<T[]> {
    const values = await this.exec<string[]>('LRANGE', key, start, stop);
    if (!values) return [];
    return values.map(v => { try { return JSON.parse(v) as T; } catch { return v as unknown as T; }});
  }
  
  async llen(key: string): Promise<number> {
    return this.exec<number>('LLEN', key);
  }
  
  async lpop<T = string>(key: string): Promise<T | null> {
    const value = await this.exec<string>('LPOP', key);
    if (!value) return null;
    try { return JSON.parse(value) as T; } catch { return value as unknown as T; }
  }
  
  async rpop<T = string>(key: string): Promise<T | null> {
    const value = await this.exec<string>('RPOP', key);
    if (!value) return null;
    try { return JSON.parse(value) as T; } catch { return value as unknown as T; }
  }
  
  async hset(key: string, field: string, value: string | number): Promise<number>;
  async hset(key: string, fields: Record<string, string | number>): Promise<number>;
  async hset(key: string, fieldOrFields: string | Record<string, string | number>, value?: string | number): Promise<number> {
    if (typeof fieldOrFields === 'string') {
      return this.exec<number>('HSET', key, fieldOrFields, String(value));
    } else {
      const args: (string | number)[] = [key];
      for (const [f, v] of Object.entries(fieldOrFields)) args.push(f, String(v));
      return this.exec<number>('HSET', ...args);
    }
  }
  
  async hget<T = string>(key: string, field: string): Promise<T | null> {
    const value = await this.exec<string>('HGET', key, field);
    if (!value) return null;
    try { return JSON.parse(value) as T; } catch { return value as unknown as T; }
  }
  
  async hgetall<T extends Record<string, string> = Record<string, string>>(key: string): Promise<T> {
    const result = await this.exec<string[]>('HGETALL', key);
    if (!result) return {} as T;
    const obj: Record<string, string> = {};
    for (let i = 0; i < result.length; i += 2) obj[result[i]] = result[i + 1];
    return obj as T;
  }
  
  async hdel(key: string, ...fields: string[]): Promise<number> {
    return this.exec<number>('HDEL', key, ...fields);
  }
  
  async hexists(key: string, field: string): Promise<number> {
    return this.exec<number>('HEXISTS', key, field);
  }
  
  async hlen(key: string): Promise<number> {
    return this.exec<number>('HLEN', key);
  }
  
  async hkeys(key: string): Promise<string[]> {
    return this.exec<string[]>('HKEYS', key) || [];
  }
  
  async hvals(key: string): Promise<string[]> {
    return this.exec<string[]>('HVALS', key) || [];
  }
  
  async scan(cursor: number, opts?: { match?: string; count?: number }): Promise<[number, string[]]> {
    const args: (string | number)[] = [cursor];
    if (opts?.match) args.push('MATCH', opts.match);
    if (opts?.count) args.push('COUNT', opts.count);
    const result = await this.exec<[string, string[]]>('SCAN', ...args);
    if (!result) return [0, []];
    return [parseInt(result[0]), result[1]];
  }
  
  async keys(pattern: string): Promise<string[]> {
    return this.exec<string[]>('KEYS', pattern) || [];
  }
  
  async type(key: string): Promise<string> {
    return this.exec<string>('TYPE', key);
  }
  
  async rename(key: string, newKey: string): Promise<'OK'> {
    return this.exec<'OK'>('RENAME', key, newKey);
  }
  
  async info(): Promise<string> {
    return this.exec<string>('INFO');
  }
  
  async flushall(): Promise<'OK'> {
    return this.exec<'OK'>('FLUSHALL');
  }
  
  async flushdb(): Promise<'OK'> {
    return this.exec<'OK'>('FLUSHDB');
  }
  
  async dbsize(): Promise<number> {
    return this.exec<number>('DBSIZE');
  }
  
  async eval<T = unknown>(script: string, keys: string[] = [], args: (string | number)[] = []): Promise<T> {
    const cmdArgs: (string | number)[] = [script, keys.length.toString(), ...keys, ...args.map(String)];
    return this.exec<T>('EVAL', ...cmdArgs);
  }
  
  async evalsha<T = unknown>(sha: string, keys: string[] = [], args: (string | number)[] = []): Promise<T> {
    const cmdArgs: (string | number)[] = [sha, keys.length.toString(), ...keys, ...args.map(String)];
    return this.exec<T>('EVALSHA', ...cmdArgs);
  }
}

export const createWebdisClient = (url: string) => new WebdisRedis({ url });
