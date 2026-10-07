import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { acquireDependencyBuildLock } from "../../../../../packages/ttsc/src/launcher/internal/runtime/acquireDependencyBuildLock";
import { releaseDependencyBuildLock } from "../../../../../packages/ttsc/src/launcher/internal/runtime/releaseDependencyBuildLock";
import { acquirePluginBuildLock } from "../../../../../packages/ttsc/src/plugin/internal/source/acquirePluginBuildLock";
import { inspectPluginBuildLock } from "../../../../../packages/ttsc/src/plugin/internal/source/inspectPluginBuildLock";
import { reclaimPluginBuildLock } from "../../../../../packages/ttsc/src/plugin/internal/source/reclaimPluginBuildLock";
import { releasePluginBuildLock } from "../../../../../packages/ttsc/src/plugin/internal/source/releasePluginBuildLock";
import { TestProject } from "../../../../utils/src/TestProject";

/**
 * Verifies lock admission: a live generation denies a second acquisition until
 * its real owner releases. Portable errno classification is covered directly in
 * the source unit
 * test_contended_candidate_rename_classifies_only_protocol_collision_errors.
 *
 * 1. Acquire each protocol's lease and assert a second acquisition is denied.
 * 2. Release each holder in finally.
 * 3. Assert each protocol admits a new lease and release those controls.
 * 4. Retire a plugin generation, then reject its stale release/reclaim and a
 *    vanished legacy fence while a successor remains active.
 *
 * @evidence contracts/testing.md#behavioral-verification Actual plugin and dependency lock admission return null while a live generation occupies current, then admit post-release leases. Plugin-only reclamation retires one observed generation; its delayed release and second captured fence cannot retire the successor. A removed legacy path's fence likewise leaves a v3 successor active.
 * @evidence contracts/testing.md#independent-expectations Owning leases establish current occupancy. Literal true/false retirement results, exact successor fence, released classification and both retained generation paths distinguish ownership from pathname reuse. A real current-PID legacy record establishes the separate namespace input; no filesystem errors are injected.
 * @evidence contracts/testing.md#distinguishing-cases Both protocols cover occupied and released current. Plugin-only rows cover two captured fences, stale finalizer/reclaimer denial, normal successor release and legacy disappearance before v3 acquisition. These ordered same-process rows do not prove two-process contention, departed-owner classification, worker barriers/close or single artifact publication/reuse. The source classifier unit separately owns errno distinctions.
 * @evidence contracts/testing.md#execution-ownership This named source unit imports the authored plugin/dependency lock owners and exercises admission/release directly over distinct temporary paths. No child process, native producer or consumer installation runs; both initial and control leases are released in finally.
 */
export function test_build_locks_deny_a_second_acquisition_until_the_live_holder_releases(): void {
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
      if (pluginHolder !== null)
        releasePluginBuildLock(pluginLock, pluginHolder);
    } finally {
      if (dependencyHolder !== null)
        releaseDependencyBuildLock(dependencyLock, dependencyHolder);
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
      if (pluginControl !== null)
        releasePluginBuildLock(pluginLock, pluginControl);
    } finally {
      if (dependencyControl !== null)
        releaseDependencyBuildLock(dependencyLock, dependencyControl);
    }
  }

  const fencedLock = path.join(root, "fenced-plugin.lock");
  const original = acquirePluginBuildLock(fencedLock);
  assert.notEqual(original, null);
  if (original === null) assert.fail("expected original plugin lease");
  let successor: ReturnType<typeof acquirePluginBuildLock> = null;
  try {
    const first = inspectPluginBuildLock(fencedLock);
    const second = inspectPluginBuildLock(fencedLock);
    assert.equal(first.state, "active");
    assert.equal(second.state, "active");
    if (first.state !== "active" || second.state !== "active")
      assert.fail("expected two captured active plugin fences");
    const originalFence = { protocol: "v3", generation: original.generation };
    assert.deepEqual(first.fence, originalFence);
    assert.deepEqual(second.fence, originalFence);
    assert.equal(reclaimPluginBuildLock(fencedLock, first.fence), true);
    successor = acquirePluginBuildLock(fencedLock);
    assert.notEqual(successor, null);
    if (successor === null) assert.fail("expected plugin successor");
    assert.notEqual(successor.generation, original.generation);
    assert.equal(releasePluginBuildLock(fencedLock, original), false);
    assert.equal(reclaimPluginBuildLock(fencedLock, second.fence), false);
    const current = inspectPluginBuildLock(fencedLock);
    assert.equal(current.state, "active");
    assert.deepEqual(current.state === "active" ? current.fence : null, {
      protocol: "v3",
      generation: successor.generation,
    });
    assert.equal(releasePluginBuildLock(fencedLock, successor), true);
    assert.deepEqual(inspectPluginBuildLock(fencedLock), { state: "released" });
    for (const generation of [original.generation, successor.generation])
      assert.equal(
        fs.existsSync(path.join(`${fencedLock}.v3`, "retired", generation)),
        true,
      );
  } finally {
    try {
      releasePluginBuildLock(fencedLock, original);
    } finally {
      if (successor !== null) releasePluginBuildLock(fencedLock, successor);
    }
  }

  const legacyLock = path.join(root, "legacy-plugin.lock");
  fs.mkdirSync(legacyLock);
  fs.writeFileSync(
    path.join(legacyLock, "owner.json"),
    JSON.stringify({
      hostname: os.hostname(),
      pid: process.pid,
      startedAt: new Date().toISOString(),
    }),
    "utf8",
  );
  const legacy = inspectPluginBuildLock(legacyLock);
  assert.equal(legacy.state, "active");
  if (legacy.state !== "active") assert.fail("expected active legacy owner");
  assert.equal(legacy.fence.protocol, "legacy");
  // This owned fixture models normal legacy pathname removal, not process exit.
  fs.rmSync(legacyLock, { recursive: true });
  const legacySuccessor = acquirePluginBuildLock(legacyLock);
  assert.notEqual(legacySuccessor, null);
  if (legacySuccessor === null)
    assert.fail("expected v3 successor after legacy removal");
  try {
    assert.equal(reclaimPluginBuildLock(legacyLock, legacy.fence), false);
    const current = inspectPluginBuildLock(legacyLock);
    assert.equal(current.state, "active");
    assert.deepEqual(current.state === "active" ? current.fence : null, {
      protocol: "v3",
      generation: legacySuccessor.generation,
    });
    assert.equal(releasePluginBuildLock(legacyLock, legacySuccessor), true);
    assert.deepEqual(inspectPluginBuildLock(legacyLock), { state: "released" });
  } finally {
    releasePluginBuildLock(legacyLock, legacySuccessor);
  }
}
