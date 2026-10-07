import crypto from "node:crypto";
import { pluginBuildVersions } from "ttsc/plugin-source";

import type { ResolvedTtscUnpluginOptions } from "../../options/ResolvedTtscUnpluginOptions";
import { unpluginVersion } from "./unpluginVersion";

/**
 * Hex digest of what a whole-project compile is, apart from the files it reads
 * (samchon/ttsc#1390).
 *
 * The ordered JSON tuple groups sharing candidates by spelled tsconfig,
 * serialized compiler-option/alias/plugin payloads, reported versions and
 * binary platform. Supported option values must preserve their meaning through
 * JSON; omitted or unsupported JavaScript values are not independent key
 * dimensions. This is a truncated digest, not a complete filesystem or output
 * equivalence proof. Claim publication and adoption separately establish the
 * recorded input/stability premises for a reused compile.
 *
 * A compile is kept beyond the process that published it, so a dev server
 * started again adopts what the last one compiled (samchon/ttsc#1483). The
 * compiler that ran is therefore part of the identity too: the ttsc and
 * TypeScript-Go versions every plugin build is keyed on, by ttsc's own rule
 * (`pluginBuildVersions` from `ttsc/plugin-source`), this adapter's version,
 * whose code decides what an adopter proves, and the platform the binaries were
 * built for. The plugins' own Go sources and the environment each builds in are
 * not: each directory's state is proven when the envelope is adopted
 * (`pluginSourceStateHolds`, samchon/ttsc#1487, samchon/ttsc#1493). Unknown
 * metadata fallback values do not independently distinguish missing versions.
 *
 * @param props.projectRoot The project the compile runs for, which resolves its
 *   TypeScript-Go.
 * @evidence contracts/common.md#principled-implementation The ordered JSON tuple hashes spelled config, serialized options/aliases/plugins, reported versions and binary platform into the claim's configuration key. JSON-compatible value semantics and separately validated recorded input state are premises; a key match alone is not a filesystem or output proof, and unknown version metadata remains a limitation.
 * @evidence contracts/common.md#clear-and-simple-design One tuple hashes configuration and version identity; source-state proof remains separate rather than being duplicated in this key.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Platform identity legitimately separates compiled binaries; it is not a fixed platform assumption or an excuse to omit plugin-source validation on adoption.
 * @evidence contracts/common.md#meaningful-documentation The native comment explains retained publications, version ownership, and why plugin-source state is proven elsewhere.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Tuple, encoded JSON and hash object are call-local; the returned digest transfers to the claim owner. Cached installation/version strings and module metadata belong to their reader owners, not an independent history or native handle acquired here.
 * @evidence contracts/performance.md#efficient-algorithms JSON serialization and SHA-256 scan the full encoded tuple text, with temporary tuple/JSON storage proportional to its payload. pluginBuildVersions adds project package resolution, manifest read/parse and any cold host-version read; unpluginVersion adds its cold self-manifest resolution. Native path/ancestor/module-resolution and metadata byte populations remain costs beyond one logical helper call. Caller getters or toJSON methods can add work or throw during encoding. The output retains 32 hex characters of the digest.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work This operation calculates a key and coordinates no completed publication or in-flight claim itself. Store claiming and capture adoption own sharing permission and proof; version helpers share only their own process-stable metadata, while this call observes the project-resolved version anew.
 * @evidence contracts/portability.md#os-neutral-implementation Platform/architecture distinguish binary targets, and the config spelling is serialized unchanged. Project and executing package versions come through Node native package resolution/readers; no OS-name case rule substitutes for that boundary. Reported metadata and a platform tuple still do not certify current native input identity or publication validity.
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
