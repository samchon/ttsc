import type { ITtscNativeBackend } from "./structures/ITtscNativeBackend";
import type { ITtscNativePluginShape } from "./structures/ITtscNativePluginShape";

export type { ITtscNativeBackend } from "./structures/ITtscNativeBackend";
export type { ITtscNativePluginContractVersion } from "./structures/ITtscNativePluginContractVersion";
export type { ITtscNativePluginShape } from "./structures/ITtscNativePluginShape";
export type { ITtscNativeRewriteMode } from "./structures/ITtscNativeRewriteMode";
export type { ITtscNativeSource } from "./structures/ITtscNativeSource";

export function resolveNativeBackend(
  plugin: ITtscNativePluginShape,
): ITtscNativeBackend | null {
  if (plugin.native && (plugin.nativeMode || plugin.nativeBinary)) {
    throw new Error(
      `ttsc: plugin "${plugin.name}" must use either native or nativeMode/nativeBinary, not both`,
    );
  }
  if (!plugin.native) {
    if (
      plugin.nativeBinary &&
      (!plugin.nativeMode || plugin.nativeMode === "none")
    ) {
      throw new Error(
        `ttsc: plugin "${plugin.name}" declared nativeBinary without a non-empty nativeMode`,
      );
    }
    if (!plugin.nativeMode || plugin.nativeMode === "none") {
      return null;
    }
    return {
      binary: plugin.nativeBinary,
      contractVersion: 1,
      mode: plugin.nativeMode,
    };
  }

  const backend = plugin.native;
  if (!backend.mode || backend.mode === "none") {
    throw new Error(
      `ttsc: plugin "${plugin.name}" declared native without a non-empty mode`,
    );
  }
  if (backend.contractVersion !== undefined && backend.contractVersion !== 1) {
    throw new Error(
      `ttsc: plugin "${plugin.name}" requested unsupported native contract version ${backend.contractVersion}`,
    );
  }
  if (backend.source) {
    if (backend.binary) {
      throw new Error(
        `ttsc: plugin "${plugin.name}" must use either native.binary or native.source, not both`,
      );
    }
    if (typeof backend.source.dir !== "string" || backend.source.dir.length === 0) {
      throw new Error(
        `ttsc: plugin "${plugin.name}" native.source.dir must be a non-empty string`,
      );
    }
  }
  return {
    ...backend,
    contractVersion: backend.contractVersion ?? 1,
  };
}
