import type { ITtscNativeBackend } from "./ITtscNativeBackend";
import type { ITtscProjectPluginConfig } from "./ITtscProjectPluginConfig";

export interface ITtscLoadedNativePlugin {
  backend: ITtscNativeBackend;
  config: ITtscProjectPluginConfig;
  name: string;
}
