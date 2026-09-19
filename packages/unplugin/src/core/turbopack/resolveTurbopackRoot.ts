import { createRequire } from "node:module";
import path from "node:path";

/**
 * Resolve the project filesystem root Turbopack was created with, the directory
 * no loader dependency may leave (samchon/ttsc#1422).
 *
 * Next 16 creates the Turbopack project with `outputFileTracingRoot ||
 * turbopack.root`. Without either, it uses `NEXT_PRIVATE_OUTPUT_TRACE_ROOT`,
 * then `findRootDirAndLockFiles(dir).rootDir` (`dist/server/config.js`). The
 * configured root reaches the loader through its options. The rest is read here
 * the same way, and through the project's own `next`, so the answer is the one
 * Next computed.
 *
 * Every Turbopack root contains the project directory, so the project directory
 * stands in whenever the answer cannot be known: when the rule does not say
 * whether the configuration set a root, or when Next's function cannot be
 * loaded. A root narrower than Turbopack's never hands Turbopack a path it
 * rejects.
 *
 * @param projectRoot The Next project directory, the loader's `rootContext`.
 * @param configured The rule's `turbopackRoot`: the configured root, `null` for
 *   none, or `undefined` when the rule does not say.
 * @param env The environment Next read.
 */
export function resolveTurbopackRoot(
  projectRoot: string,
  configured: string | null | undefined,
  env: NodeJS.ProcessEnv = process.env,
): string {
  if (typeof configured === "string" && configured.length !== 0) {
    return path.resolve(configured);
  }
  if (configured === undefined) return path.resolve(projectRoot);
  const traced = env.NEXT_PRIVATE_OUTPUT_TRACE_ROOT;
  if (typeof traced === "string" && traced.length !== 0) {
    return path.resolve(traced);
  }
  try {
    const findRoot = createRequire(path.join(projectRoot, "package.json"))(
      "next/dist/lib/find-root",
    ) as {
      findRootDirAndLockFiles?(directory: string): { rootDir?: unknown };
    };
    const found = findRoot.findRootDirAndLockFiles?.(projectRoot)?.rootDir;
    if (typeof found === "string" && found.length !== 0) {
      return path.resolve(found);
    }
  } catch {
    // Next's own function is unavailable, so its answer cannot be known.
  }
  return path.resolve(projectRoot);
}
