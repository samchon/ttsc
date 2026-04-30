import type { ITtscCommonOptions } from "./ITtscCommonOptions";

export interface ITtscRegisterOptions extends ITtscCommonOptions {
  cacheDir?: string;
  project?: string;
  extensions?: readonly string[];
}
