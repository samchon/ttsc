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
 *
 * @evidence contracts/common.md#principled-implementation The wrapper supplies the real WASM boot and result parser to the same typed service core exposed over tgrid.
 * @evidence contracts/common.md#clear-and-simple-design Runtime binding stays in this thin factory while pipeline state and serialization remain in the service core.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Dependency injection is a supported binding seam, without replacement of foreign APIs or test-only production paths.
 * @evidence contracts/common.md#meaningful-documentation Native JSDoc demonstrates WorkerServer registration and required runtime identity, with descriptive text separated from tags under the documentation skill.
 * @evidence contracts/performance.md#efficient-algorithms The bound service builds two config strings once, then writes the current project and processes its actual transform, emit and diagnostics. The shared mutation queue permits one pipeline to mutate the virtual project at a time; compiler algorithm cost remains with the WASM engine.
 * @evidence contracts/performance.md#reuse-equivalent-work The service closure shares runtime boot and a separately retryable source mount; stable factory options define their identity. Pre-start boot failures evict the runtime attempt, post-start failures remain terminal, and mount failures retry using the already-ready runtime rather than starting another Go instance.
 * @evidence contracts/performance.md#bound-retention-and-release-resources The service retains one runtime, mounted virtual files and a promise-chain tail for its Worker lifetime; queued requests retain their closures until settlement without a request-count bound. The owning client terminates the Worker on replacement or unmount because the Go runtime has no in-Worker disposal mechanism.
 */
export function createWorkerCompiler(
  options: ICreateWorkerCompilerOptions,
): ICompilerService {
  return createWorkerCompilerService({ bootTtsc, parseResult }, options);
}
