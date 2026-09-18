import path from "node:path";

import type { TtscCachedProjectTransform } from "../cache/TtscCachedProjectTransform";

/**
 * Tell the user once per file and generation that a module reached ttsc with
 * text that differs from the file it names (samchon/ttsc#1394).
 *
 * Ttsc compiles the whole project from disk, so the delivered text never
 * reaches the output: the module is served from the compile of the file on
 * disk. That is right when the host read the file just before it changed, and
 * the host's next delivery resolves it. It is wrong when a plugin ordered
 * before ttsc rewrote the module, because that rewrite is then dropped, so the
 * report names the likely cause instead of letting the rewrite vanish
 * silently.
 */
export function reportDivergentDelivery(
  cached: TtscCachedProjectTransform,
  file: string,
): void {
  const reported = (cached.divergentDeliveryReported ??= new Set<string>());
  const key = path.resolve(file);
  if (reported.has(key)) return;
  reported.add(key);
  const name = path.relative(cached.projectRoot, key).split(path.sep).join("/");
  process.stderr.write(
    `ttsc: ${name} reached ttsc with text that differs from the file on disk. ` +
      "ttsc transforms the file as it is on disk, so the delivered text was " +
      "not used. If another plugin rewrites this module, order it after ttsc " +
      '(ttsc runs with enforce: "pre").\n',
  );
}
