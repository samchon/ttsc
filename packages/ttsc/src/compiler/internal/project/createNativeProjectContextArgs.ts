import type { ITtscParsedProjectConfig } from "../../../structures/internal/ITtscParsedProjectConfig";
import { createNativeProjectContextJson } from "./createNativeProjectContextJson";

/** Serialize the retained project identity for a native sidecar invocation. */
export function createNativeProjectContextArgs(
  project: ITtscParsedProjectConfig,
  pluginConfigOrigin?: string,
): string[] {
  return [
    "--project-context-json=" +
      createNativeProjectContextJson(project, pluginConfigOrigin),
  ];
}
