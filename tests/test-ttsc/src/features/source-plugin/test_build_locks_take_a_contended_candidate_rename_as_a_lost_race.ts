import { TestProject } from "../../../../utils/src/TestProject";
import assert from "node:assert/strict";
import path from "node:path";

import { acquireDependencyBuildLock } from "../../../../../packages/ttsc/src/launcher/internal/runtime/acquireDependencyBuildLock";
import { releaseDependencyBuildLock } from "../../../../../packages/ttsc/src/launcher/internal/runtime/releaseDependencyBuildLock";
import { acquirePluginBuildLock } from "../../../../../packages/ttsc/src/plugin/internal/source/acquirePluginBuildLock";
import { releasePluginBuildLock } from "../../../../../packages/ttsc/src/plugin/internal/source/releasePluginBuildLock";

/**
 * Verifies lock admission: a live generation denies a second acquisition until its real owner releases.
 * Portable errno classification is covered directly in the source unit
 * test_contended_candidate_rename_classifies_only_protocol_collision_errors.
 *
 * 1. Acquire each protocol's lease and assert a second acquisition is denied.
 * 2. Release each holder in finally.
 * 3. Assert each protocol admits a new lease and release those controls.
 *
 * @evidence contracts/testing.md#behavioral-verification Actual plugin and dependency lock admission return null while a live generation occupies current, then return non-null leases after that generation is released.
 * @evidence contracts/testing.md#independent-expectations Two acquired owning leases establish actual current occupancy; null contender and non-null post-release controls are literal lock-admission expectations, without injecting filesystem errors.
 * @evidence contracts/testing.md#distinguishing-cases Both independent lock protocols cover occupied current and released current. The source classifier unit separately retains EPERM/EACCES and adjacent non-collision errno distinctions, including an error without a destination lookup.
 * @evidence contracts/testing.md#execution-ownership This named source unit imports the authored plugin/dependency lock owners and exercises admission/release directly over distinct temporary paths. No child process, native producer or consumer installation runs; both initial and control leases are released in finally.
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
