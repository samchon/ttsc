import type { ITtscProjectPluginConfig } from "../ITtscProjectPluginConfig";
import type { TtscPluginStage } from "../TtscPluginStage";

/** Native sidecar selected and built from one plugin descriptor. */
export interface ITtscLoadedNativePlugin {
  /** Executable produced by the lazy Go source build cache. */
  binary: string;
  /** Original tsconfig plugin entry passed unchanged to the sidecar. */
  config: ITtscProjectPluginConfig;
  /** Stable plugin name used in diagnostics and native manifests. */
  name: string;
  /** Pipeline stage where the sidecar participates. */
  stage: TtscPluginStage;
}
