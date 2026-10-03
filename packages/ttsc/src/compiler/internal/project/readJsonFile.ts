import fs from "node:fs";

import { ConfigJsonText } from "./ConfigJsonText";

/**
 * Read and parse a strict-JSON configuration file (`package.json`), naming it
 * on parse failure. Native file-read failures propagate from Node unchanged.
 *
 * A leading UTF-8 BOM is accepted, matching the tsconfig reader:
 * the two readers are consulted for the same project and disagreeing about a
 * byte order mark would only surprise the user who hit it.
 *
 * The parsed value remains unknown; its consuming contract validates root
 * shape.
 *
 * @evidence contracts/common.md#principled-implementation JSON.parse owns strict JSON syntax after one length-preserving leading-BOM replacement; returning unknown avoids claiming that arbitrary valid JSON is already a package-record shape.
 * @evidence contracts/common.md#clear-and-simple-design The reader owns filename-attributed parse errors and delegates BOM and error rendering to shared text helpers; root-shape validation belongs to each consuming schema.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Malformed configuration remains an error with its real filename, without comment stripping or an empty-object fallback that would weaken strict JSON semantics.
 * @evidence contracts/common.md#meaningful-documentation Purpose, BOM rationale and unknown-root ownership are documented in native paragraphs following the documentation skill; obsolete comment-stripping claims were removed.
 * @evidence contracts/portability.md#os-neutral-implementation Node receives the native filename and explicit UTF-8 decoding; a BOM is a text-format distinction rather than an OS-specific path or newline rule.
 * @evidence contracts/performance.md#bound-retention-and-release-resources Node owns the synchronous file-read handle lifecycle; input and normalized text are local, while the caller owns the returned parsed value. Completion makes local references reclaimable without guaranteeing immediate engine reclamation or independent backing storage for returned strings; no historical file registry is retained here.
 * @evidence contracts/performance.md#efficient-algorithms One native UTF-8 read, optional length-preserving BOM replacement and builtin JSON.parse incur file/path lookup, byte decoding and parsed-value construction costs. Temporary text and returned values grow with input content; fixed call counts do not make the delegated work constant, and no second parse or comment-removal pass is added.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work This reader owns no cross-request config coordination or validity proof; it reads current mutable file content and returns a caller-owned value rather than sharing an unvalidated historical result.
 */
export function readJsonFile(file: string): unknown {
  const text = ConfigJsonText.stripLeadingBom(fs.readFileSync(file, "utf8"));
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(
      `ttsc: failed to parse ${file}: ${ConfigJsonText.describe(error)}`,
    );
  }
}
