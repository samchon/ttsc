import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

import type { CompilerArchives } from "./CompilerArchives";

/**
 * Shared artifact preparation used by direct units and the real Node child.
 *
 * @evidence contracts/common.md#principled-implementation One typed facade and its authored CommonJS entry connect both consumers to the same artifact decision operation.
 * @evidence contracts/common.md#clear-and-simple-design The namespace exposes only preparation and the actual child entry; suite lifecycle, installation and benchmark materialization remain with their callers.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The shared operation is not duplicated behind a unit implementation or private E2E import, and the child loads ordinary CommonJS without an added loader or build.
 * @evidence contracts/common.md#meaningful-documentation The namespace identifies both consumers, runtimePath documents native child addressing, and prepare documents toolchain and reader authority.
 * @evidence contracts/portability.md#os-neutral-implementation The runtime entry is derived from the authored module URL through Node's native path conversion, without a shell spelling or OS case assumption.
 * @evidence contracts/performance.md#efficient-algorithms Module initialization resolves and loads one shared entry; preparation forwards its arguments and delegates the existing package-order map and bounded archive streams.
 * @evidence contracts/performance.md#reuse-equivalent-work Node caches the runtime module within each process; actual artifact qualification and packing remain request operations rather than cached test outcomes.
 * @evidence contracts/performance.md#bound-retention-and-release-resources Module references last for the process. The preparation operation closes its archive descriptors, while the actual reader and allocation lifetime remain caller-owned.
 */
export namespace CompilerArtifactPreparation {
  /**
   * Native absolute path derived from this authored module's URL.
   *
   * The E2E caller delivers this entry to its plain Node preparation child so
   * that child loads the same implementation as the TypeScript facade.
   */
  export const runtimePath = fileURLToPath(
    new URL("./internal/CompilerArtifactPreparationRuntime.cjs", import.meta.url),
  );
  const runtime = createRequire(import.meta.url)(runtimePath) as {
    prepareArtifacts: typeof prepare;
  };

  /**
   * Select caller artifacts or qualify borrowed archives before normal packing.
   *
   * The supplied toolchain owns package selection and actual producers. This
   * facade calls the same CommonJS implementation loaded by the real child;
   * installation, reader completion and loan return remain with its caller.
   *
   * @evidence contracts/common.md#principled-implementation Delegates artifact selection and qualification to the single authored CommonJS operation, preserving complete caller artifacts, standalone production and exact borrowed archive guards.
   * @evidence contracts/common.md#clear-and-simple-design A typed call and absolute runtime path connect TypeScript units and the plain Node preparation child without importing suite orchestration or compiling another helper.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Both consumers execute the same maintained operation; the facade neither replaces a foreign method nor supplies a test-only packing or installation result.
   * @evidence contracts/common.md#meaningful-documentation The headline and parameter comments identify artifact selection, toolchain authority, the authored child entry and the caller-owned reader lifetime.
   * @evidence contracts/portability.md#os-neutral-implementation Native URL-to-path conversion locates the CommonJS entry on Windows and POSIX. The delegated implementation qualifies actual native file identity and bytes; producer process behavior stays with the supplied toolchain.
   * @evidence contracts/performance.md#efficient-algorithms The facade forwards one request without copying archives or rebuilding inputs. The delegated map follows toolchain order and streams selected bytes through a fixed buffer.
   * @evidence contracts/performance.md#reuse-equivalent-work Node loads one authored runtime per process, while each request still performs its required archive qualification or normal producers. Only explicitly supplied immutable generations avoid duplicate packing.
   * @evidence contracts/performance.md#bound-retention-and-release-resources The facade retains the module entry and forwards the operation's promise; archive descriptors close inside the runtime, and the caller retains allocation and loan authority until its actual readers complete.
   */
  export function prepare(
    request: {
      /** Actual repository whose manifests define toolchain package names. */
      repository: string;

      /** Caller-owned root for archives produced by this preparation. */
      root: string;

      /** Complete caller payloads bypass packing only when both are supplied. */
      toolchain?: { name: string; archive: string }[];

      /** Explicit Evidence payload paired with a complete toolchain. */
      artifact?: { name: string; archive: string };

      /** Exact generation borrowed until the actual preparation reader ends. */
      borrowedCompilerArchives?: readonly CompilerArchives.Artifact[];
    },
    toolchain: {
      /** Ordered package selection owned by the actual preparation toolchain. */
      directories: readonly string[];

      /** Normal standalone producer for the complete selected toolchain. */
      pack: (
        repository: string,
        output: string,
      ) => Promise<{ name: string; archive: string }[]>;

      /** Normal producer for each package not supplied through a valid loan. */
      packPackage: (
        repository: string,
        directory: string,
        archive: string,
      ) => Promise<void>;
    },
  ): Promise<{
    toolchain: { name: string; archive: string }[];
    artifact: { name: string; archive: string };
  }> {
    return runtime.prepareArtifacts(request, toolchain);
  }
}
