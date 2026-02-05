declare module 'net-snmp' {
  export const Version1: number;
  export const Version2c: number;

  export interface SessionOptions {
    version?: number;
    timeout?: number;
    retries?: number;
  }

  export interface Session {
    get(oids: string[], callback: (error: any, varbinds: any[]) => void): void;
    close(): void;
  }

  export function createSession(
    target: string,
    community: string,
    options?: SessionOptions,
  ): Session;
}
