import type { ITtscNativeBackend } from "./ITtscNativeBackend";
import type { ITtscNativeRewriteMode } from "./ITtscNativeRewriteMode";

export interface ITtscPlugin {
  name: string;
  native?: ITtscNativeBackend;
  /** @deprecated Use `native.mode` instead. */
  nativeMode?: ITtscNativeRewriteMode;
  /** @deprecated Use `native.binary` instead. */
  nativeBinary?: string;
}
