import { TestUnpluginProject } from "@ttsc/testing";
import path from "node:path";

/**
 * Select the linked Program probe from the same immutable authored module as
 * the synthetic protocol producer. The two Go packages have different native
 * entrypoints and artifacts; sharing this source publisher does not merge them.
 * Callers retain their own manifest entry and external runLog configuration.
 *
 * @evidence contracts/common.md#principled-implementation sharedNativeFixtureSource publishes the authored module bytes; compile-probe selects its non-main SDK contributor package without a package-local go.mod. The actual linked-host builder owns contributor copying and compilation.
 * @evidence contracts/common.md#clear-and-simple-design One existing materializer and memo own the module identity for all consumers; this provider forwards the package path and leaves project preparation and manifest configuration to its callers.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Actual authored Go bytes still reach standalone and linked native builds through their supported entrypoints. This path selection fabricates no compiler output and does not treat unequal transform profiles as equivalent.
 * @evidence contracts/common.md#meaningful-documentation The prose distinguishes common source identity from distinct artifacts and identifies the caller-owned configuration; publishing source is not claimed to run a Program.
 * @evidence contracts/portability.md#os-neutral-implementation Native path.join and the existing shared publisher preserve the package-relative compile-probe address on Windows and POSIX; this provider does not shell-quote paths or infer path case.
 * @evidence contracts/performance.md#efficient-algorithms The shared materializer owns the initial three-file copy and digest. This provider adds one path join, with work proportional to path length, and starts no enumeration or compilation itself.
 * @evidence contracts/performance.md#reuse-equivalent-work All callers use the same process-memoized, content-addressed authored module; the non-main package selection preserves its own native build key. Authored module bytes remain frozen for that process memo.
 * @evidence contracts/performance.md#bound-retention-and-release-resources This forwarding operation retains no independent memo or native handle. The shared source owner retains one module path and owns staging cleanup; callers and native owners retain their own process and artifact lifetimes.
 */
export function realNativeEnvelopeContributor(): string {
  return path.join(
    TestUnpluginProject.sharedNativeFixtureSource(),
    "compile-probe",
  );
}
