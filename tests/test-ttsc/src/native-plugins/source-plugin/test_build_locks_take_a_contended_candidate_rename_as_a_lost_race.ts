import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import path from "node:path";

import { acquireDependencyBuildLock, releaseDependencyBuildLock } from "../../internal/dependency-cache";
import { acquirePluginBuildLock, releasePluginBuildLock } from "../../internal/source-build";

/**
 * A live generation denies a second acquisition until its real owner releases.
 * Portable errno classification is covered directly in the source unit
 * test_contended_candidate_rename_classifies_only_protocol_collision_errors.
 * @evidence contracts/testing.md#behavioral-verification Actual plugin and dependency lock admission return null while a live generation occupies current, then return non-null leases after that generation is released.
 * @evidence contracts/testing.md#independent-expectations Two acquired owning leases establish actual current occupancy; null contender and non-null post-release controls are literal lock-admission expectations, without injecting filesystem errors.
 * @evidence contracts/testing.md#distinguishing-cases Both independent lock protocols cover occupied current and released current. The source classifier unit separately retains EPERM/EACCES and adjacent non-collision errno distinctions, including an error without a destination lookup.
 * @evidence contracts/testing.md#execution-ownership The exported entry calls shipped acquire/release operations against real native directory generations. It replaces no global operation and every acquired lease has a finally owner.
 * @evidence contracts/e2e.md#necessary-boundary Actual generation publication, occupancy and retirement must connect each lock protocol to native directory state; direct errno classification cannot detect admission that ignores an occupied current generation.
 * @evidence contracts/e2e.md#shared-execution One private root supplies the two protocol paths without an installation, Go build or child host. The two protocol leases are separate ownership resources, not repeated compiler preparations.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Each protocol has its own lock path. Initial holders and successful post-release controls are released in finally, and neither fixture mutates shared fs methods or uses a prior case's generation.
 * @evidence contracts/e2e.md#preserved-coverage Both original null/non-null protocol outcomes remain with actual occupancy instead of a foreign injected rename. The exact four accepted errno values and neighboring failures are preserved and strengthened in the named source classifier unit; this case makes no claim to force a kernel EPERM race.
 */
export function test_build_locks_take_a_contended_candidate_rename_as_a_lost_race(): void {
  const root = TestProject.tmpdir("ttsc-lock-contended-rename-");
  const pluginLock = path.join(root, "plugin.lock");
  const dependencyLock = path.join(root, "dependency.lock");
  const pluginHolder = acquirePluginBuildLock(pluginLock);
  let dependencyHolder: ReturnType<typeof acquireDependencyBuildLock> = null;
  try {
    assert.notEqual(pluginHolder, null);
    dependencyHolder = acquireDependencyBuildLock(dependencyLock);
    assert.notEqual(dependencyHolder, null);
    assert.equal(acquirePluginBuildLock(pluginLock), null);
    assert.equal(acquireDependencyBuildLock(dependencyLock), null);
  } finally {
    try {
      if (pluginHolder !== null) releasePluginBuildLock(pluginLock, pluginHolder);
    } finally {
      if (dependencyHolder !== null) releaseDependencyBuildLock(dependencyLock, dependencyHolder);
    }
  }
  const pluginControl = acquirePluginBuildLock(pluginLock);
  let dependencyControl: ReturnType<typeof acquireDependencyBuildLock> = null;
  try {
    assert.notEqual(pluginControl, null);
    dependencyControl = acquireDependencyBuildLock(dependencyLock);
    assert.notEqual(dependencyControl, null);
  } finally {
    try {
      if (pluginControl !== null) releasePluginBuildLock(pluginLock, pluginControl);
    } finally {
      if (dependencyControl !== null) releaseDependencyBuildLock(dependencyLock, dependencyControl);
    }
  }
}
