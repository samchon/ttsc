// Worker-side playground compiler factory.
//
// This module ships a ready-to-bind `ICompilerService` implementation. The
// consumer's worker entry boots the wasm once, builds tsconfig variants for
// the site's chosen module shape, registers the typia/lint plugin verbs (or
// the site-provided overrides), and serializes every MemFS-mutating call onto
// a single chain so concurrent compiles never corrupt each other.
//
// The pipeline logic lives in `createWorkerCompilerService`, which takes the
// `@ttsc/wasm` boot / result-parsing functions as injected dependencies. This
// wrapper is the only place that imports them at runtime, so the service can be
// tested against a fake `IBootResult` without building or booting WASM.
import { bootTtsc, parseResult } from "@ttsc/wasm";

import type { ICompilerService } from "../structures/ICompilerService";
import type { ICreateWorkerCompilerOptions } from "../structures/ICreateWorkerCompilerOptions";
import { createWorkerCompilerService } from "./internal/createWorkerCompilerService";

/**
 * Build an `ICompilerService` ready to register with tgrid's `WorkerServer`.
 *
 * Usage in the worker entry:
 *
 * ```ts
 * import { createWorkerCompiler } from "@ttsc/playground";
 * import { WorkerServer } from "tgrid";
 *
 * const service = createWorkerCompiler({
 *   wasmUrl: "/compiler/playground.wasm",
 *   apiName: "ttscPlayground",
 *   typiaPlugin: { mount: installTypiaPack },
 * });
 *
 * const main = async () => {
 *   const worker = new WorkerServer();
 *   await worker.open(service);
 * };
 * void main();
 * ```
 */
export function createWorkerCompiler(
  options: ICreateWorkerCompilerOptions,
): ICompilerService {
  return createWorkerCompilerService({ bootTtsc, parseResult }, options);
}
