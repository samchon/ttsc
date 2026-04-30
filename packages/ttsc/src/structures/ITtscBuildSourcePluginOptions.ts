import type { ITtscNativeSource } from "./ITtscNativeSource";

export interface ITtscBuildSourcePluginOptions {
  source: ITtscNativeSource;
  pluginName: string;
  baseDir: string;
  ttscVersion: string;
  tsgoVersion: string;
}
