import type { ITtscPluginCapabilities } from "../ITtscPluginCapabilities";
import type { ITtscPluginContributor } from "../ITtscPluginContributor";
import type { ITtscProjectPluginConfig } from "../ITtscProjectPluginConfig";
import type { TtscPluginStage } from "../TtscPluginStage";

/** Native plugin source selected and built from one plugin descriptor. */
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
