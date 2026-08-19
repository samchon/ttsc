import type { ITtscParsedProjectConfig } from "../../../structures/internal/ITtscParsedProjectConfig";

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

/**
 * The identity payload itself, for a caller that spawns a sidecar without going
 * through the compiler's own argument list.
 *
 * Split from the flag so there is still exactly one place that decides what a
 * sidecar is told about the project. A second caller assembling the same JSON,
 * or slicing it back out of the flag, is how the two drift.
 */
export function createNativeProjectContextJson(
  project: ITtscParsedProjectConfig,
  pluginConfigOrigin?: string,
): string {
  return JSON.stringify({
    ...project.identity,
    ...(pluginConfigOrigin === undefined ? {} : { pluginConfigOrigin }),
  });
}
