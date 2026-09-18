import crypto from "node:crypto";

import type { ResolvedTtscUnpluginOptions } from "../../options/ResolvedTtscUnpluginOptions";

/**
 * Hex digest of what a whole-project compile is, apart from the files it reads
 * (samchon/ttsc#1390).
 *
 * Two compiles with the same identity and the same project state produce the
 * same envelope, so one worker's compile may stand for another's. Everything
 * the adapter hands the compiler goes in: the tsconfig, the compiler-option and
 * alias overlays, and the plugin list. Workers with different options, such as
 * two rules of one Turbopack config, never share.
 */
export function sharedCompileIdentity(props: {
  aliasPaths: Record<string, string[]>;
  compilerOptions: Record<string, unknown>;
  plugins?: ResolvedTtscUnpluginOptions["plugins"];
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
      ]),
    )
    .digest("hex")
    .slice(0, 32);
}
