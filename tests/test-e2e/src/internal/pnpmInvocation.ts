import assert from "node:assert/strict";

/**
 * Invoke the E2E runner's pnpm with native argv. JavaScript entry files use
 * Node and standalone executables run directly.
 *
 * @evidence contracts/common.md#principled-implementation npm_execpath identifies the actual runner and the entry suffix selects whether Node is its interpreter.
 * @evidence contracts/common.md#clear-and-simple-design Archive and Evidence setup share the same argv construction and own their process lifetimes.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts An absent runner entry is reported and no shell command or PATH guess replaces it.
 * @evidence contracts/common.md#meaningful-documentation The comment distinguishes the two installed pnpm forms and native argv.
 * @evidence contracts/portability.md#os-neutral-implementation Node handles JavaScript entry files across platforms; standalone executables retain their exact path.
 * @evidence contracts/performance.md#efficient-algorithms Checks one suffix and, for JavaScript, prepends one argument to the supplied list.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Invocation construction retains no earlier runner environment or arguments.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The returned command and arguments acquire no process or storage.
 */
export function pnpmInvocation(args: string[]): {
  binary: string;
  args: string[];
} {
  const entry = process.env.npm_execpath;
  assert.ok(entry, "The E2E runner must be launched through pnpm");
  return /\.[cm]?js$/i.test(entry)
    ? { binary: process.execPath, args: [entry, ...args] }
    : { binary: entry, args };
}
