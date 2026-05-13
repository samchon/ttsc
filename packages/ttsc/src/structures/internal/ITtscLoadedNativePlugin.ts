import type { ITtscPluginContributor } from "../ITtscPluginContributor";
import type { ITtscProjectPluginConfig } from "../ITtscProjectPluginConfig";
import type { TtscPluginStage } from "../TtscPluginStage";

/** Native sidecar selected and built from one plugin descriptor. */
export interface ITtscLoadedNativePlugin {
  /** Executable produced by the lazy Go source build cache. */
  binary: string;
  /** Original tsconfig plugin entry passed unchanged to the sidecar. */
  config: ITtscProjectPluginConfig;
  /** Contributor Go sources statically linked into the binary, if any. */
  contributors?: readonly ITtscPluginContributor[];
  /** Stable plugin name used in diagnostics and native manifests. */
  name: string;
  /** Go source directory selected by the plugin descriptor. */
  source: string;
  /** Pipeline stage where the sidecar participates. */
  stage: TtscPluginStage;
}
