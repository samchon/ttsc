import type { ITtscPluginCapabilities } from "../ITtscPluginCapabilities";
import type { ITtscPluginContributor } from "../ITtscPluginContributor";
import type { ITtscProjectPluginConfig } from "../ITtscProjectPluginConfig";
import type { TtscPluginStage } from "../TtscPluginStage";

/**
 * Native plugin source selected and built from one plugin descriptor.
 *
 * @evidence contracts/common.md#principled-implementation Loaded state pairs the built executable with source, original configuration and stage; executable versus linked distinguishes process dispatch from composition into another host.
 * @evidence contracts/common.md#clear-and-simple-design This host-owned record carries resolved descriptor facts needed by later execution without exposing descriptor evaluation or cache machinery to consumers.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Capability and reportsTypeScriptDiagnostics declarations govern forwarding and guard behavior; names remain labels rather than special-case routing keys.
 * @evidence contracts/common.md#meaningful-documentation Native member comments describe binary provenance, original config, linked ownership and capability meaning; blank member lines and prose/tag separation follow the documentation skill.
 * @evidence contracts/portability.md#os-neutral-implementation Binary and source are resolved native paths supplied by the loader/build owner; this representation neither hardcodes platform suffixes nor serializes process execution as shell text.
 */
export interface ITtscLoadedNativePlugin {
  /** Executable produced by the lazy Go source build cache. */
  binary: string;

  /**
   * Capability flags declared by the descriptor (see
   * `ITtscPluginCapabilities`).
   */
  capabilities?: ITtscPluginCapabilities;

  /** Original tsconfig plugin entry passed unchanged to the native plugin. */
  config: ITtscProjectPluginConfig;

  /** Contributor Go sources statically linked into the binary, if any. */
  contributors?: readonly ITtscPluginContributor[];

  /** Whether this source owns a process or is linked into another host. */
  kind: "executable" | "linked";

  /** Optional human label used in diagnostics and native manifests. */
  name?: string;

  /** Whether a check-stage plugin already emits TypeScript diagnostics. */
  reportsTypeScriptDiagnostics?: boolean;

  /** Go source directory selected by the plugin descriptor. */
  source: string;

  /** Pipeline stage where the native source participates. */
  stage: TtscPluginStage;
}
