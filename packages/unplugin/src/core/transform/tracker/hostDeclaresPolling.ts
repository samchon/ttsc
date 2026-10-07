/**
 * Whether the user has declared that this filesystem needs polling, because a
 * native watch on it is accepted and then never reports an event
 * (samchon/ttsc#1395).
 *
 * Some mounted or remote filesystem configurations need that fallback; mount
 * names alone do not identify them. This reads the explicit conventions of
 * Chokidar and Watchpack, rather than certifying the host's final watcher
 * mode:
 *
 * - `CHOKIDAR_USEPOLLING`, read by chokidar (Vite's watcher) and overriding the
 *   host's own `usePolling` option: `false` and `0` turn polling off, `true`
 *   and `1` turn it on, and any other non-empty value turns it on.
 * - `WATCHPACK_POLLING`, read by Watchpack (webpack and Next.js): a numeric value
 *   forces polling when its canonical numeric conversion is truthy (not zero or
 *   NaN), and other strings request it unless empty or `false`.
 *
 * @param env The process environment to read.
 * @param usePolling The host watcher's own polling option, such as Vite's
 *   `server.watch.usePolling`, which `CHOKIDAR_USEPOLLING` overrides.
 * @evidence contracts/common.md#principled-implementation
 *   Explicit polling declarations select the adapter's fallback; their absence
 *   does not prove native event coverage. Chokidar overrides the supplied option
 *   and an independent Watchpack declaration can also require polling.
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
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Retains nothing.
 * @evidence contracts/performance.md#efficient-algorithms Two environment keys are queried, with early return after a true Chokidar/option verdict. Lowercasing and canonical numeric parsing/formatting depend on supplied string lengths; the key count does not make parsing constant-cost.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Re-read per call because a host's polling declaration can change; nothing is shared.
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
    ? Boolean(+watchpack)
    : watchpack !== "" && watchpack !== "false";
}
