import type { ITtscPlugin } from "./ITtscPlugin";
import type { ITtscPluginFactoryContext } from "./ITtscPluginFactoryContext";
import type { ITtscProjectPluginConfig } from "./ITtscProjectPluginConfig";

export type ITtscPluginFactory<T = ITtscProjectPluginConfig> = (
  context: ITtscPluginFactoryContext<T>,
) => ITtscPlugin;
