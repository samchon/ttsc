import path from "node:path";
import {
  pluginSourceDigest,
  pluginSourceFilesSignature,
} from "ttsc/plugin-source";

import { DEFAULT_FILESYSTEM_OPERATIONS } from "../filesystem/DEFAULT_FILESYSTEM_OPERATIONS";
import type { TtscTransformFilesystemOperations } from "../filesystem/TtscTransformFilesystemOperations";
import { inputMetadataEvidence } from "./inputMetadataEvidence";

/**
 * The digest of a plugin source directory's files (`pluginSourceDigest` from
 * `ttsc/plugin-source`), read again only when the metadata of those files moved
 * or cannot vouch for their bytes.
 *
 * A plugin source is re-proven on every delivery its tracker cannot vouch for:
 * a macOS stream outside the project root, which no probe proves delivered
 * (samchon/ttsc#1453), a tracker that failed or heard a gap, a host without
 * one. Reading the files each time costs what a build does, measured at 169 ms
 * for typia's 622-file module root, on every delivery of a dev server. The
 * universal entries skip their content the same way
 * (`captureUniversalHostInputValidation`): while an input's metadata signature
 * matches the one taken around the read that proved it, and the filesystem's
 * clock had provably left each stamp's tick before that read
 * (`stampSeparable`), no write since can have kept the signature. The signature
 * covers exactly the files the digest reads, each by its path relative to the
 * directory (`pluginSourceFilesSignature`), so a file added, removed, or
 * renamed moves it as an edit does. A digest is kept only when the signature
 * taken before its read equals the one taken after and every stamp in it is
 * separable, and reused only while the signature taken now equals it and is
 * separable from the clock reference minted now: after a clock rollback a write
 * can land in the tick of a recorded stamp, which only a fresh reference
 * answers for, as the project walk re-checks its own
 * (`collectProjectInputSnapshot`).
 *
 * @param directory The source directory.
 * @param filesystem The operations whose clock reference the caller refreshed
 *   (`refreshFilesystemClockReference`), which decides separability.
 * @throws When a listed file cannot be read, as `pluginSourceDigest` does.
 */
export function pluginSourceFilesDigest(
  directory: string,
  filesystem: TtscTransformFilesystemOperations = DEFAULT_FILESYSTEM_OPERATIONS,
): string {
  const key = path.resolve(directory);
  const evidence = (file: string) => inputMetadataEvidence(file, filesystem);
  const before = pluginSourceFilesSignature(key, evidence);
  const known = DIGESTS.get(key);
  if (
    before !== undefined &&
    before.separable &&
    known?.signature === before.signature
  ) {
    return known.digest;
  }
  const digest = pluginSourceDigest(key);
  const after = pluginSourceFilesSignature(key, evidence);
  if (
    before !== undefined &&
    after !== undefined &&
    after.signature === before.signature &&
    after.separable
  ) {
    DIGESTS.set(key, { digest, signature: after.signature });
  } else {
    DIGESTS.delete(key);
  }
  return digest;
}

/**
 * The digests kept, by directory, each with the signature of the metadata it
 * was read under.
 */
const DIGESTS = new Map<string, { digest: string; signature: string }>();
