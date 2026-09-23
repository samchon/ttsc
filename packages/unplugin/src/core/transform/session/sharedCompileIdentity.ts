import crypto from "node:crypto";
import { pluginBuildVersions } from "ttsc/plugin-source";

import type { ResolvedTtscUnpluginOptions } from "../../options/ResolvedTtscUnpluginOptions";
import { unpluginVersion } from "./unpluginVersion";

/**
 * Hex digest of what a whole-project compile is, apart from the files it reads
 * (samchon/ttsc#1390).
 *
 * Two compiles with the same identity and the same project state produce the
 * same envelope, so one worker's compile may stand for another's. Everything
 * the adapter hands the compiler goes in: the tsconfig, the compiler-option and
 * alias overlays, and the plugin list. Workers with different options, such as
 * two rules of one Turbopack config, never share.
 *
 * A compile is kept beyond the process that published it, so a dev server
 * started again adopts what the last one compiled (samchon/ttsc#1483). The
 * compiler that ran is therefore part of the identity too: the ttsc and
 * TypeScript-Go versions every plugin build is keyed on, by ttsc's own rule
 * (`pluginBuildVersions` from `ttsc/plugin-source`), this adapter's version,
 * whose code decides what an adopter proves, and the platform the binaries were
 * built for. The plugins' own Go sources are not: each is proven by its digest
 * when the envelope is adopted (samchon/ttsc#1487).
 *
 * @param props.projectRoot The project the compile runs for, which resolves its
 *   TypeScript-Go.
 */
export function sharedCompileIdentity(props: {
  aliasPaths: Record<string, string[]>;
  compilerOptions: Record<string, unknown>;
  plugins?: ResolvedTtscUnpluginOptions["plugins"];
  projectRoot: string;
  tsconfig: string;
}): string {
  return crypto
    .createHash("sha256")
    .update(
      JSON.stringify([
        props.tsconfig,
        props.compilerOptions,
        props.aliasPaths,
        props.plugins ?? null,
        pluginBuildVersions(props.projectRoot),
        unpluginVersion(),
        `${process.platform}-${process.arch}`,
      ]),
    )
    .digest("hex")
    .slice(0, 32);
}
