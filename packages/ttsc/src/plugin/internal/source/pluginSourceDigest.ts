import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { collectPluginSourceFiles } from "./collectPluginSourceFiles";

/**
 * The files of one plugin source directory as a plugin build reads them: a
 * SHA-256 over the relative path and bytes of every file the build keys its
 * binary on (`collectPluginSourceFiles`), in sorted order.
 *
 * A plugin's binary is keyed on these files, so the output of every transform
 * that ran the binary is a function of them. The cache key folds the digest of
 * each directory it covers (`computeCacheKey`), and the transform envelope
 * reports each plugin source directory's state
 * (`ITtscCompilerTransformation.ISuccess.pluginSources`), this digest together
 * with the build environment (`pluginSourceState`, samchon/ttsc#1493), so a
 * consumer that caches the output proves it still holds through the
 * `ttsc/plugin-source` entry (`pluginSourceStateHolds`) instead of a copy of
 * the rule (samchon/ttsc#1487).
 *
 * Content rather than size and modification time: the build reads every byte
 * anyway, and a consumer's proof must not accept an edit that kept a file's
 * size within one clock tick. A consumer that proves a source on every delivery
 * may keep a digest it read while the metadata of every listed file holds still
 * and each stamp provably left its clock tick before the read, and hand it to
 * `pluginSourceStateHolds`; that judgment is the consumer's, which owns a clock
 * reference, and the file list is this one's. A directory that does not exist
 * has the digest of an empty one, as it keys the build.
 *
 * @param directory The source directory.
 * @returns The digest, as lowercase hex.
 * @throws When a listed file cannot be read, as the build itself would.
 */
export function pluginSourceDigest(directory: string): string {
  const hash = crypto.createHash("sha256");
  for (const file of collectPluginSourceFiles(directory)) {
    hash.update(`f=${path.relative(directory, file).replace(/\\/g, "/")}\n`);
    hash.update(fs.readFileSync(file));
    hash.update("\n");
  }
  return hash.digest("hex");
}
