/**
 * Whether a webpack or Rspack watcher configured with `ignored` may skip a
 * path, so that a compiler input there reaches the host's channel but no change
 * to it ever rebuilds.
 *
 * Read from the watching compiler's own `watchOptions`. When the configuration
 * sets none, Rspack's `Watching` puts its default there,
 * `/[\\/](?:\.git|node_modules)[\\/]/`, as Rspack 1.7.11 and 2.0.0 both do. The
 * package contract measured the consequence on 2.0.0: a declaration package
 * created below `node_modules` never rebuilt a watching Rspack build. webpack
 * sets no default, but the configuration Next.js 16 builds ignores
 * `node_modules`, `.git`, and `.next`, and many configurations ignore
 * `node_modules` as well.
 *
 * Both hosts test a regular expression against the path written with forward
 * slashes, as watchpack does, and call a function with the path itself.
 * Rspack's native watcher may test the path as written instead, so a path
 * matching in either spelling counts. A glob, alone or in a list, goes through
 * the host's own glob engine, which the adapter does not reproduce. Every path
 * is then treated as possibly ignored, so an input can be observed twice,
 * costing a second rebuild, but is never missed.
 *
 * @param ignored The watching compiler's `watchOptions.ignored`.
 */
export function hostWatchIgnores(ignored: unknown): (file: string) => boolean {
  if (ignored === undefined || ignored === null) return () => false;
  if (ignored instanceof RegExp) {
    const matches = (value: string): boolean => {
      // A global or sticky expression carries its last position across calls.
      ignored.lastIndex = 0;
      return ignored.test(value);
    };
    return (file) => matches(file) || matches(file.replace(/\\/g, "/"));
  }
  if (typeof ignored === "function") {
    return (file) => {
      try {
        return Boolean((ignored as (file: string) => unknown)(file));
      } catch {
        return true;
      }
    };
  }
  // watchpack skips an empty glob, so a list of nothing ignores nothing.
  const globs = Array.isArray(ignored) ? ignored : [ignored];
  if (globs.every((glob) => glob === "")) return () => false;
  return () => true;
}
