import fs from "node:fs";
import path from "node:path";

import { findNearestGoMod } from "../../../compiler/internal/findNearestGoMod";

/**
 * The Go module a plugin's `source` builds in: the package directory the source
 * names, the module root above it, and the package's path inside the module.
 *
 * A `source` names a Go package directory or its `go.mod` file, and may sit
 * anywhere below its module: the nearest `go.mod` within
 * {@link GO_MOD_SEARCH_MAX_DEPTH} parents is the module root. The build copies
 * and keys that whole root (`buildSourcePlugin`, `computeCacheKey`), so a
 * sibling package or the module's own `go.mod` moves the binary as much as the
 * package itself does. Everything that needs the module a plugin builds in, the
 * build, the loader's validation, and the inputs a watch session observes
 * (samchon/ttsc#1492), takes it from here, so the rule has one reading.
 *
 * @param source The source, absolute, which the caller has found to exist.
 * @param pluginName The plugin's label in an error.
 * @throws When the source is neither a directory nor a `go.mod` file, or no
 *   `go.mod` lies within reach above it.
 */
export function resolvePluginGoModule(
  source: string,
  pluginName: string,
): { entry: string; moduleRoot: string; packageDir: string } {
  const stat = fs.statSync(source);
  const packageDir =
    stat.isFile() && path.basename(source) === "go.mod"
      ? path.dirname(source)
      : stat.isDirectory()
        ? source
        : null;
  if (packageDir === null) {
    throw new Error(
      `ttsc: plugin "${pluginName}" source must be a Go package directory or go.mod file: ${source}`,
    );
  }
  const goMod = findNearestGoMod(packageDir, GO_MOD_SEARCH_MAX_DEPTH);
  if (goMod === null) {
    throw new Error(
      `ttsc: plugin "${pluginName}" source must be inside a Go module with go.mod within ${GO_MOD_SEARCH_MAX_DEPTH} parent directories: ${source}`,
    );
  }
  const moduleRoot = path.dirname(goMod);
  const relative = path.relative(moduleRoot, packageDir).replace(/\\/g, "/");
  return {
    entry: relative === "" ? "." : `./${relative}`,
    moduleRoot,
    packageDir,
  };
}

/** How many parent directories above a plugin package `go.mod` may lie. */
const GO_MOD_SEARCH_MAX_DEPTH = 3;
