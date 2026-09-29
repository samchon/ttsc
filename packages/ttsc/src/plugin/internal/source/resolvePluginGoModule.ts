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
 *
 * @throws When the source is neither a directory nor a `go.mod` file, or no
 *   `go.mod` lies within reach above it.
 *
 * @evidence contracts/common.md#principled-implementation The source must denote a package directory or go.mod; the bounded nearest-module search and relative package entry make copying/keying the entire owning module consistent with Go compilation.
 * @evidence contracts/common.md#clear-and-simple-design Input classification and module discovery are visible in one small adapter; the nearest-manifest operation is shared with compiler code.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The three-parent reach is an explicit current source-plugin contract, with a descriptive failure rather than a guessed module or consumer-specific escape.
 * @evidence contracts/common.md#meaningful-documentation Native prose explains whole-module identity, the documented reach limit and both failure classes; tags are separated from parameter prose.
 * @evidence contracts/portability.md#os-neutral-implementation Native source identity uses Node stat/dirname/relative; returned Go package entries use slash protocol spelling, distinct from filesystem lookup paths.
 * @evidence contracts/performance.md#efficient-algorithms At most the configured parent reach is inspected, with no recursive repository scan or sibling source traversal.
 *
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Current source type and nearest manifest must be observed afresh; this resolver owns no memo.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The resolver retains no file descriptor or historical directory state.
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
