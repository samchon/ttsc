import fs from "node:fs";

/**
 * Require the selected source to exist and retain descriptor-path guidance.
 *
 * @evidence contracts/common.md#principled-implementation Actual filesystem existence determines admission; the unchanged diagnostic explains the supported factory-context alternatives when a descriptor path is absent.
 * @evidence contracts/common.md#clear-and-simple-design One path probe owns this preflight decision; Go module/package classification remains the following loader operation.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Uses the real selected source path and filesystem rather than filenames or a fabricated loader result.
 * @evidence contracts/common.md#meaningful-documentation The owning headline and retained diagnostic explain how callers correct a missing path.
 *
 * @evidence contracts/portability.md#os-neutral-implementation Accepts the caller-selected native path directly at fs.existsSync; diagnostic path spelling is retained and no slash assumptions or shell operations are introduced.
 * @evidence contracts/performance.md#efficient-algorithms One existence probe and a bounded diagnostic construct do not traverse the source tree.
 * @evidence contracts/performance.md#reuse-equivalent-work The operation reobserves caller-owned filesystem state per request because a previous absence or presence does not establish continued validity.
 * @evidence contracts/performance.md#bound-retention-and-release-resources It retains no source contents or handles; the synchronous filesystem probe finishes before the decision returns.
 */
export function requirePluginSource(source: string, label: string): void {
  if (!fs.existsSync(source)) {
    // A descriptor factory runs without CommonJS globals when ttsc loads it
    // through ttsx or as ESM — `__dirname`/`__filename`/`require` are undefined,
    // so a `source` derived from them mis-resolves (often against cwd) and lands
    // here. Name that failure mode explicitly instead of leaving a bare
    // not-found path: the breakage is otherwise silent.
    throw new Error(
      `ttsc: plugin "${label}" source does not exist: ${source}\n` +
        `  Plugin descriptors run without CommonJS globals: __dirname, __filename, ` +
        `and require are undefined when ttsc loads a descriptor through ttsx or as ESM. ` +
        `If this path was derived from one of them, use context.dirname / ` +
        `context.filename (the descriptor's own directory and file, populated in ` +
        `every load mode), or resolve it from context.projectRoot, e.g. ` +
        `createRequire(path.join(context.projectRoot, "package.json"))` +
        `.resolve("<your-package>/package.json").`,
    );
  }
}
