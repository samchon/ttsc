import type { ITtscPlugin } from "./ITtscPlugin";
import type { ITtscPluginFactoryContext } from "./ITtscPluginFactoryContext";
import type { ITtscProjectPluginConfig } from "./ITtscProjectPluginConfig";

/** Factory form exported by a ttsc plugin package. */
export type ITtscPluginFactory<T = ITtscProjectPluginConfig> = (
  context: ITtscPluginFactoryContext<T>,
) => ITtscPlugin;
