import type { IMemFSHost } from "@ttsc/wasm";

/**
 * Options for the typia integration of {@link createWorkerCompiler}.
 *
 * @evidence contracts/common.md#principled-implementation Host registration id, transform module and source mounting callback represent the three distinct integration inputs.
 * @evidence contracts/common.md#clear-and-simple-design Typia-specific settings are nested away from runtime boot and per-call enablement.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Default identities are supported typia configuration and remain explicitly replaceable by the site.
 * @evidence contracts/common.md#meaningful-documentation Members explain host identity, transform module and forwarded virtual work directory, with documentation-skill paragraphs and spacing.
  * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type definition declares a shape and retains no state or handle.
  * @evidenceExclude contracts/performance.md#efficient-algorithms A type definition declares a shape and performs no computation.
  * @evidenceExclude contracts/performance.md#reuse-equivalent-work A type definition declares a shape and shares no computation.
  * @evidenceExclude contracts/portability.md#os-neutral-implementation A type definition owns no native filesystem, path or process decision.
 */
export interface ITypiaPluginConfig {
  /** Plugin id registered with `host.Expose` (default: `"typia"`). */
  name?: string;

  /**
   * Module specifier the typia transform receives via `compilerOptions.plugins`
   * (default: `"typia/lib/transform"`).
   */
  transformModule?: string;

  /**
   * Optional hook to mount typia source files into the MemFS once the wasm
   * runtime is ready, before the first request runs. The site fetches its
   * pre-built typia pack and writes it under
   * `<workDir>/node_modules/`. A rejected mount is retried by the next request
   * without starting another runtime. `workDir` is forwarded from
   * `createWorkerCompiler` so the mount can honor a non-default project root
   * without the site rewiring the URL.
   */
  mount?: TypiaSourceMount;
}

/**
 * Mount typia sources into the live virtual host after boot at the actual work directory.
 *
 * @evidence contracts/common.md#principled-implementation Host and workDir identify the filesystem and project root that compilation actually uses.
 * @evidence contracts/common.md#clear-and-simple-design One asynchronous mount hook leaves boot and serial compilation with the worker factory.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Mounting uses IMemFSHost without patching compiler internals or guessing the project root.
 * @evidence contracts/common.md#meaningful-documentation Native prose names timing, filesystem and directory ownership before the separated tags.
  * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type definition declares a shape and retains no state or handle.
  * @evidenceExclude contracts/performance.md#efficient-algorithms A type definition declares a shape and performs no computation.
  * @evidenceExclude contracts/performance.md#reuse-equivalent-work A type definition declares a shape and shares no computation.
  * @evidenceExclude contracts/portability.md#os-neutral-implementation A type definition owns no native filesystem, path or process decision.
 */
export type TypiaSourceMount = (
  host: IMemFSHost,
  workDir: string,
) => Promise<void>;
