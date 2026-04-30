import type { ITtscLoadedNativePlugin } from "./ITtscLoadedNativePlugin";
import type { ITtscParsedProjectConfig } from "./ITtscParsedProjectConfig";
import type { ITtscPlugin } from "./ITtscPlugin";

export interface ITtscLoadedPlugins {
  compatibilityFallback: boolean;
  nativeBinary: string | null;
  nativeBinaries: string[];
  nativePlugins: ITtscLoadedNativePlugin[];
  plugins: ITtscPlugin[];
  project: ITtscParsedProjectConfig;
}
