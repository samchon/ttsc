import path from "node:path";

import { normalizeTypeScriptPathSeparators } from "./normalizeTypeScriptPathSeparators";
import { startsWithConfigDirTemplate } from "./startsWithConfigDirTemplate";

/** Resolve one config path with TypeScript's leading `${configDir}` template. */
export function resolveConfigDirTemplatePath(
  baseDir: string,
  target: string,
  configDir: string = baseDir,
): string {
  const template = "${configDir}";
  const normalized = normalizeTypeScriptPathSeparators(target);
  return startsWithConfigDirTemplate(normalized)
    ? path.resolve(configDir, normalized.replace(template, "./"))
    : path.resolve(baseDir, normalized);
}
