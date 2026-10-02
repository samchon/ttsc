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
 * built for. The plugins' own Go sources and the environment each builds in are
 * not: each directory's state is proven when the envelope is adopted
 * (`pluginSourceHolds`, samchon/ttsc#1487, samchon/ttsc#1493).
 *
 * @param props.projectRoot The project the compile runs for, which resolves its
 *   TypeScript-Go.
 *
 * @evidence contracts/common.md#principled-implementation Compiler options, aliases, plugins, compiler versions, adapter version, and binary platform distinguish compile configurations before the project-state claim.
 * @evidence contracts/common.md#clear-and-simple-design One tuple hashes configuration and version identity; source-state proof remains separate rather than being duplicated in this key.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Platform identity legitimately separates compiled binaries; it is not a fixed platform assumption or an excuse to omit plugin-source validation on adoption.
 * @evidence contracts/common.md#meaningful-documentation The native comment explains retained publications, version ownership, and why plugin-source state is proven elsewhere.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Retains nothing; it returns a string.
 * @evidence contracts/performance.md#efficient-algorithms One JSON serialisation and one SHA-256 of the identity tuple, plus pluginBuildVersions, once per compile attempt.
 * @evidence contracts/performance.md#reuse-equivalent-work The digest is the sharing identity: equal compiles across workers map to one publication, and any difference in options, plugins or versions separates them.
 * @evidence contracts/portability.md#os-neutral-implementation The platform and architecture are part of the identity because the compiled binaries differ per platform, and the tsconfig path is hashed as spelled, without case or separator rewriting.
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
