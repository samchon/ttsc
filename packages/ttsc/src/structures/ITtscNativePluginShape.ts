import type { ITtscNativeBackend } from "./ITtscNativeBackend";
import type { ITtscNativeRewriteMode } from "./ITtscNativeRewriteMode";

export interface ITtscNativePluginShape {
  name: string;
  native?: ITtscNativeBackend;
  nativeMode?: ITtscNativeRewriteMode;
  nativeBinary?: string;
}
