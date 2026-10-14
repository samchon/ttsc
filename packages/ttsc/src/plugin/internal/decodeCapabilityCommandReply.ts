import type { spawnSync } from "node:child_process";
import { deserialize } from "node:v8";

/**
 * Decode one same-runtime command relay reply without interpreting user data.
 *
 * Parent and worker share one Node version and exchange disposable V8-encoded
 * bytes. Native Buffers, sparse arrays and enumerable diagnostic data retain
 * their values without JSON conversion or an ambiguous Buffer marker reviver.
 * Invalid bytes throw; this decoder grants no native retirement authority.
 *
 * @evidence contracts/common.md#principled-implementation Node's structured serialization reconstructs actual byte buffers and the compiler serializer's data graph without treating user metadata as control markers. The private parent and worker use the same Node runtime, so this is not a cross-version persistent artifact contract.
 * @evidence contracts/common.md#clear-and-simple-design One supported binary decoding operation returns the existing reply envelope; compiler-error restoration and native retirement classification stay with their owners.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Structured transport replaces JSON's data loss instead of layering marker guesses or permitting lost fields; malformed bytes remain errors rather than becoming successful commands.
 * @evidence contracts/common.md#meaningful-documentation Native prose identifies same-runtime disposable bytes, retained values, decoding failure and the absence of retirement authority.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation Node's V8 transport represents data only; this decoder queries no native process or filesystem and introduces no OS-name policy.
 * @evidence contracts/performance.md#efficient-algorithms One delegated deserialization processes the actual encoded graph and byte buffers; no independent recursive scan or marker conversion follows it here.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Each command reply contains independent observed outputs and is decoded independently.
 * @evidence contracts/performance.md#bound-retention-and-release-resources Parsed data and decoded buffers transfer to the caller; temporary parse state has no global history or native handle.
 */
export function decodeCapabilityCommandReply(bytes: Uint8Array): {
  retirement?: "joined" | "not-started" | "unknown";
  result?: ReturnType<typeof spawnSync>;
  thrown?: unknown;
} {
  return deserialize(bytes);
}
