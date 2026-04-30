import type { ITtscProjectPluginConfig } from "./ITtscProjectPluginConfig";

export interface ITtscLoadPluginsOptions {
  binary: string;
  cwd?: string;
  entries?: readonly ITtscProjectPluginConfig[] | false;
  file?: string;
  tsconfig?: string;
}
