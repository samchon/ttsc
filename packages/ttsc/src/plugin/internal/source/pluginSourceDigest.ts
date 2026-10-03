import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { collectPluginSourceFiles } from "./collectPluginSourceFiles";

/**
 * The files of one plugin source directory as a plugin build reads them: a
 * SHA-256 over the relative path and bytes of every file the build keys its
 * binary on (`collectPluginSourceFiles`), in sorted order. Each JSON header
 * gives the relative path and exact following byte length, so file contents
 * cannot imitate another file's boundary.
 *
 * A plugin's binary is keyed on these files. Its transform output can also
 * depend on runtime inputs that the owning producer must report; this digest
 * alone does not certify all such dependencies. The cache key folds the digest of
 * each directory it covers (`computeCacheKey`), and the transform envelope
 * reports each plugin source directory's state
 * (`ITtscCompilerTransformation.ISuccess.pluginSources`), this digest together
 * with the build environment (`pluginSourceState`), so a
 * consumer that caches the output proves it still holds through the
 * `ttsc/plugin-source` entry (`pluginSourceStateHolds`) instead of a copy of
 * the rule.
 *
 * Content rather than size and modification time: the build reads every byte
 * anyway, and a consumer's proof must not accept an edit that kept a file's
 * size within one clock tick. A consumer that proves a source on every delivery
 * may keep a digest under matching metadata and the observing owner's
 * separability policy, then hand it to
 * `pluginSourceStateHolds`; that judgment is the consumer's, which owns a clock
 * reference, and the file list is this one's. A directory that does not exist
 * has the digest of an empty one, as it keys the build.
 *
 * @param directory The source directory.
 *
 * @returns The digest, as lowercase hex.
 *
 * @throws When a listed file cannot be read, as the build itself would.
 *
 * @evidence contracts/common.md#principled-implementation Sorted relative paths and byte lengths form unambiguous JSON headers followed by exact file bytes; embedded newlines cannot imitate another file boundary, and metadata alone cannot establish source equality.
 * @evidence contracts/common.md#clear-and-simple-design Selection belongs to collectPluginSourceFiles and this function owns only deterministic content hashing.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Source identity uses the build's declared file population rather than expected outputs, fixture names or mtime-only shortcuts.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs distinguish content and metadata proofs, state missing-directory behavior and identify lowercase-hex output and read failures.
 * @evidence contracts/portability.md#os-neutral-implementation Native paths are made root-relative and slash-normalized only for digest serialization; filesystem reads retain the original native paths.
 * @evidence contracts/performance.md#efficient-algorithms Sorted enumeration includes native lookup and path-text-sensitive comparisons; each selected file is read in full and its normalized relative path/JSON length header plus B content bytes are hashed. Each iteration uses one file Buffer with the complete path population and transient serialization; native reads/path/header bytes also contribute costs.
 *
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work This computes a fresh digest; load-scoped maps and separable metadata proofs own reuse of that digest.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The hash and per-file buffers are call-local; no persistent descriptor or cache is owned here.
 */
export function pluginSourceDigest(directory: string): string {
  const hash = crypto.createHash("sha256");
  for (const file of collectPluginSourceFiles(directory)) {
    const relative = path.relative(directory, file).split(path.sep).join("/");
    const contents = fs.readFileSync(file);
    hash.update(JSON.stringify([relative, contents.length]));
    hash.update(contents);
  }
  return hash.digest("hex");
}
