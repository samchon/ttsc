import type { ITtscProjectPluginConfig } from "./ITtscProjectPluginConfig";

export interface ITtscPluginFactoryContext<T = ITtscProjectPluginConfig> {
  binary: string;
  cwd: string;
  plugin: T;
  projectRoot: string;
  tsconfig: string;
}
