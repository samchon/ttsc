import fs from "node:fs";
import { registerHooks } from "node:module";
import path from "node:path";

import { observeLexicalPackagePath } from "./observeLexicalPackagePath";
import { resolvePhysicalProjectPath } from "./resolvePhysicalProjectPath";

/**
 * Resolve with the caller's Node hooks, and refuse a known lossy POSIX result.
 * The observer reads the native conditions from this same lookup. Its separate
 * lexical proof cannot replace a different result supplied by the caller.
 *
 * @evidence contracts/common.md#principled-implementation Preserves the caller's require result or error except when an independent lexical resolution proves a raw native path matches a lossy standard selection.
 * @evidence contracts/common.md#clear-and-simple-design Config inheritance and installed SDK selection share native alias handling without rebuilding Node package search.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts A temporary hook observes conditions and delegates unchanged. The lossy old spelling is only compared and never used by the witness to open a file.
 * @evidence contracts/common.md#meaningful-documentation States caller authority, observation scope and the refusal case.
 * @evidence contracts/portability.md#os-neutral-implementation Native Node resolution and filesystem APIs own package lookup and native alias qualification. Windows needs only the calling resolver.
 * @evidence contracts/performance.md#efficient-algorithms Performs one caller resolution and on POSIX one bounded lexical inspection. The caller's standard resolver owns package traversal.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Each resolution needs current observations. The worker owner handles startup reuse.
 * @evidence contracts/performance.md#bound-retention-and-release-resources The hook is deregistered after the caller lookup. This operation keeps no previous path or live worker handle.
 */
export function resolveNativePackagePath(
  resolver: NodeRequire,
  from: string,
  specifier: string,
  owner: "extended config" | "bundled Go executable",
): string {
  if (process.platform === "win32") return resolver.resolve(specifier);
  let conditions: string[] | undefined;
  const observer =
    typeof registerHooks === "function"
      ? registerHooks({
          resolve(request, context, next) {
            if (request === specifier && conditions === undefined)
              conditions = [...context.conditions];
            return next(request, context);
          },
        })
      : undefined;
  let selected: string | undefined;
  let failure: unknown;
  try {
    selected = resolver.resolve(specifier);
  } catch (error) {
    failure = error;
  } finally {
    observer?.deregister();
  }
  const lexical = observeLexicalPackagePath(from, specifier, conditions);
  if (lexical !== undefined && path.isAbsolute(lexical)) {
    try {
      resolvePhysicalProjectPath(lexical, owner);
    } catch (error) {
      if (selected === undefined || selected === lexical) throw error;
      // A different path chosen by a registered hook is still authoritative.
      let ordinary: string | undefined;
      try {
        ordinary = fs.realpathSync(lexical);
      } catch {
        // Node could not represent the lexical answer at this spelling.
      }
      if (ordinary === selected) throw error;
    }
  }
  if (selected === undefined) throw failure;
  return selected;
}
