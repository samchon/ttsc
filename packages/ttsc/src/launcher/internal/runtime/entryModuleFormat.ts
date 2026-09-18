import { realPath } from "./realPath";
import { RuntimeManifestRegistry } from "./RuntimeManifestRegistry";
import { RuntimeModuleFormat } from "./RuntimeModuleFormat";

/**
 * The module format of the entry source file, derived from the entry project's
 * compiler options (via the runtime manifest) the same way the served files are
 * classified. The bootstrap uses it to load the entry through a CommonJS
 * `require` or an ESM `import`.
 */
export function entryModuleFormat(entryFile: string): "module" | "commonjs" {
  const real = realPath(entryFile);
  const owner = RuntimeManifestRegistry.findEntryEmit(real)?.manifest;
  return RuntimeModuleFormat.moduleFormat(
    entryFile,
    owner === undefined ? null : (owner.moduleOptions ?? {}),
  ) === "module"
    ? "module"
    : "commonjs";
}
