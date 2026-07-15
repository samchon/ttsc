// A fake `IBootResult` harness for the worker compiler service.
//
// `createWorkerCompilerService` takes its `@ttsc/wasm` boot + result-parsing
// collaborators as injected `deps`, so the whole plugin-envelope pipeline can be
// exercised here without building or booting a real WASM binary. Each test wires
// its own `api.plugin` / `api.build` handlers (which may resolve an envelope or
// reject) and reads back what the service did through the recorded call log.
import type {
  IBootResult,
  IBootTtscOptions,
  ITtscBuildOpts,
  ITtscPluginOpts,
  ITtscResult,
} from "@ttsc/wasm";

import {
  type IWorkerCompilerDeps,
  createWorkerCompilerService,
} from "../../../../packages/playground/lib/src/compiler/internal/createWorkerCompilerService.js";
import type { ICompilerService } from "../../../../packages/playground/lib/src/structures/ICompilerService.js";
import type { ICreateWorkerCompilerOptions } from "../../../../packages/playground/lib/src/structures/ICreateWorkerCompilerOptions.js";

/**
 * Required-field defaults for `ICreateWorkerCompilerOptions`. The fake boot
 * ignores `wasmUrl` / `apiName`, but the public option type demands them; a test
 * spreads this and adds only the plugin toggles it exercises.
 */
export const BASE_OPTIONS = {
  wasmUrl: "test://playground.wasm",
  apiName: "ttsc",
} satisfies Pick<ICreateWorkerCompilerOptions, "wasmUrl" | "apiName">;

/** Per-verb fake handlers a test supplies; either may throw/reject. */
export interface IFakeApi {
  plugin?: (opts: ITtscPluginOpts) => ITtscResult | Promise<ITtscResult>;
  build?: (opts: ITtscBuildOpts) => ITtscResult | Promise<ITtscResult>;
}

/** Everything the service touched during a test, for oracle assertions. */
export interface IFakeRecord {
  /** Plugin verb invocations, in order (e.g. `transform`, `check`). */
  plugin: ITtscPluginOpts[];
  /** Build invocations, in order. Length 0 proves the build never ran. */
  build: ITtscBuildOpts[];
  /** Final MemFS text at each written path (last write wins). */
  writes: Record<string, string>;
}

export interface IFakeWorker {
  service: ICompilerService;
  record: IFakeRecord;
}

/** A well-formed `ITtscResult` envelope with the given overrides. */
export const envelope = (over: Partial<ITtscResult>): ITtscResult => ({
  code: 0,
  stdout: "",
  stderr: "",
  result: "",
  ...over,
});

/** A `build`/`check` compile-result payload for `parseResult` to deserialize. */
export const compilePayload = (
  output: Record<string, string>,
  diagnostics: unknown[] = [],
): string => JSON.stringify({ output, diagnostics });

/**
 * Build the worker service over a fake boot. `boot` counts how many times the
 * service booted; the plugin/build handlers default to a benign empty success
 * so a test only has to override the verb it cares about.
 */
export function makeFakeWorker(
  options: ICreateWorkerCompilerOptions,
  api: IFakeApi,
): IFakeWorker {
  const record: IFakeRecord = { plugin: [], build: [], writes: {} };

  const host = {
    writeFile(path: string, data: string | Uint8Array): void {
      record.writes[path] = typeof data === "string" ? data : String(data);
    },
  } as unknown as IBootResult["host"];

  const fakeApi = {
    async plugin(opts: ITtscPluginOpts): Promise<ITtscResult> {
      record.plugin.push(opts);
      if (api.plugin) return api.plugin(opts);
      return envelope({});
    },
    async build(opts: ITtscBuildOpts): Promise<ITtscResult> {
      record.build.push(opts);
      if (api.build) return api.build(opts);
      return envelope({ result: compilePayload({}) });
    },
  } as unknown as IBootResult["api"];

  const deps: IWorkerCompilerDeps = {
    bootTtsc: async (_options: IBootTtscOptions): Promise<IBootResult> => ({
      api: fakeApi,
      host,
    }),
    parseResult: <T>(result: ITtscResult): T | null => {
      try {
        return JSON.parse(result.result) as T;
      } catch {
        return null;
      }
    },
  };

  return { service: createWorkerCompilerService(deps, options), record };
}
