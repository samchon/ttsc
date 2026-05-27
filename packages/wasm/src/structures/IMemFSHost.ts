import type { IWasmExecFS } from "./IWasmExecFS";

/**
 * Handle returned by `createMemFS`. Provides the `fs` shim to install on
 * `globalThis` plus convenience methods for seeding the virtual filesystem
 * before booting the wasm.
 */
export interface IMemFSHost {
  fs: IWasmExecFS;
  writeFile(path: string, data: string | Uint8Array): void;
  readFile(path: string): Uint8Array | null;
  readFileText(path: string): string | null;
  exists(path: string): boolean;
  mkdirp(path: string): void;
  stdout: { buffer: string };
  stderr: { buffer: string };
  resetStdio(): void;
}
