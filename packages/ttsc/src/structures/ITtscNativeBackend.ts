import type { ITtscNativePluginContractVersion } from "./ITtscNativePluginContractVersion";
import type { ITtscNativeRewriteMode } from "./ITtscNativeRewriteMode";
import type { ITtscNativeSource } from "./ITtscNativeSource";

export interface ITtscNativeBackend {
  mode: ITtscNativeRewriteMode;
  binary?: string;
  source?: ITtscNativeSource;
  contractVersion?: ITtscNativePluginContractVersion;
  capabilities?: readonly string[];
}
