import { TestProject } from "@ttsc/testing";

import {
  assert,
  fs,
  path,
  prunePackageArtifactRoot,
  waitForCondition,
  withGoBuildCacheLease,
} from "../../../../internal/ttsc/internal/source-build";

/**
 * Verify whole-generation artifact eviction yields to an active native build.
 *
 * Verifies: an expired artifact root survives a live cache lease and is
 * reclaimed after the lease's qualified callback closure.
 *
 * 1. Seed an ordinary old artifact root beside a managed Go cache.
 * 2. Attempt collection under a live lease and require its body to remain.
 * 3. Collect after the lease and require the old generation to disappear.
 *
 * @evidence contracts/testing.md#behavioral-verification The shipped lease and collector operate on actual temporary files and assert both protected and released outcomes.
 * @evidence contracts/testing.md#independent-expectations A literal last-use timestamp older than thirty days defines eligibility independently of body names or collector internals.
 * @evidence contracts/testing.md#distinguishing-cases Active and settled lease states distinguish protected from reclaimable ownership; an absent marker and malformed path are separate conservative cases in the owner.
 * @evidence contracts/testing.md#execution-ownership The test owns one temporary root and uses the existing managed-cache heartbeat without spawning a Go compilation.
 * @evidence contracts/e2e.md#necessary-boundary A real cross-process heartbeat and filesystem removal exercise the product's lease/maintenance arbitration.
 * @evidence contracts/e2e.md#shared-execution One root and one lease cover both sides of the lifetime transition.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity TestProject owns the isolated root, and the real lease callback returns before the post-closure deletion check.
 * @evidence contracts/e2e.md#preserved-coverage This new owner adds artifact-generation reclamation without replacing existing Go cache or clean tests.
 */
export const test_package_artifact_gc_preserves_active_native_builds =
  async (): Promise<void> => {
    const root = TestProject.tmpdir("ttsc-package-artifact-gc-");
    const go = path.join(root, "go-build");
    const artifact = path.join(root, "package-artifacts");
    const body = path.join(artifact, "base", "packs", "old-body");
    fs.mkdirSync(path.dirname(body), { recursive: true });
    fs.writeFileSync(body, "retained body");
    const now = Date.now();
    fs.writeFileSync(
      path.join(artifact, ".last-used"),
      `${now - 31 * 24 * 60 * 60 * 1000}\n`,
    );
    withGoBuildCacheLease(go, true, () => {
      prunePackageArtifactRoot(go, artifact, now);
      assert.equal(fs.readFileSync(body, "utf8"), "retained body");
    });
    await waitForCondition(() => {
      prunePackageArtifactRoot(go, artifact, now);
      return !fs.existsSync(artifact);
    }, "settled artifact maintenance after lease closure");
    assert.equal(fs.existsSync(artifact), false);
  };
