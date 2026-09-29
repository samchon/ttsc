/**
 * Whether the user has declared that this filesystem needs polling, because a
 * native watch on it is accepted and then never reports an event
 * (samchon/ttsc#1395).
 *
 * WSL2's `/mnt/<drive>` mounts, Docker Desktop bind mounts, and NFS or SMB
 * shares behave that way, and the tools that run on them are told to poll. The
 * declarations read here are the ones those tools already honor, parsed exactly
 * as each tool parses them, so ttsc agrees with the host about whether it
 * polls:
 *
 * - `CHOKIDAR_USEPOLLING`, read by chokidar (Vite's watcher) and overriding the
 *   host's own `usePolling` option: `false` and `0` turn polling off, `true`
 *   and `1` turn it on, and any other non-empty value turns it on.
 * - `WATCHPACK_POLLING`, read by Watchpack (webpack and Next.js): a numeric value
 *   polls when it is not zero, and any other value polls unless it is empty or
 *   `false`.
 *
 * @param env The process environment to read.
 * @param usePolling The host watcher's own polling option, such as Vite's
 *   `server.watch.usePolling`, which `CHOKIDAR_USEPOLLING` overrides.
 * @evidence contracts/common.md#principled-implementation
 *   Explicit host polling declarations determine whether native event silence
 *   is usable; Chokidar overrides its option and Watchpack remains independent.
 * @evidence contracts/common.md#clear-and-simple-design
 *   Two named declarations and one option are parsed at this boundary; callers
 *   receive a boolean without duplicating environment interpretation.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   Host-owned variable names are interoperability inputs, not mount-name
 *   heuristics or a hardcoded inventory of unreliable filesystems.
 * @evidence contracts/common.md#meaningful-documentation
 *   Native paragraphs, declaration list and parameter comments explain
 *   precedence and parsing under the documentation skill.
 * @evidence contracts/portability.md#os-neutral-implementation
 *   OS-neutral code follows explicit host capabilities instead of guessing
 *   from drive letters, mount prefixes or the operating-system name.
 */
export function hostDeclaresPolling(
  env: NodeJS.ProcessEnv = process.env,
  usePolling?: boolean,
): boolean {
  const chokidar = env.CHOKIDAR_USEPOLLING;
  let polling = usePolling === true;
  if (chokidar !== undefined) {
    const value = chokidar.toLowerCase();
    polling = value === "false" || value === "0" ? false : value !== "";
  }
  if (polling) return true;
  const watchpack = env.WATCHPACK_POLLING;
  if (watchpack === undefined) return false;
  return `${+watchpack}` === watchpack
    ? +watchpack !== 0
    : watchpack !== "" && watchpack !== "false";
}
