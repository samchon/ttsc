import type { ITtscProjectPluginConfig } from "./ITtscProjectPluginConfig";

export interface ITtscParsedProjectConfig {
  compilerOptions: {
    outDir?: string;
    plugins: ITtscProjectPluginConfig[];
  } & Record<string, unknown>;
  path: string;
  root: string;
}
