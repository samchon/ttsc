import type { ITtscParsedProjectConfig } from "../../../structures/internal/ITtscParsedProjectConfig";

/** Serialize the retained project identity for a native sidecar invocation. */
export function createNativeProjectContextArgs(
  project: ITtscParsedProjectConfig,
  pluginConfigOrigin?: string,
): string[] {
  return [
    "--project-context-json=" +
      JSON.stringify({
        ...project.identity,
        ...(pluginConfigOrigin === undefined ? {} : { pluginConfigOrigin }),
      }),
  ];
}
