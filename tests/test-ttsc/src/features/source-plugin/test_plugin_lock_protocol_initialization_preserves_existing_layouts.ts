import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { PluginBuildLockProtocol } from "../../../../../packages/ttsc/src/plugin/internal/source/PluginBuildLockProtocol";
import { acquirePluginBuildLock } from "../../../../../packages/ttsc/src/plugin/internal/source/acquirePluginBuildLock";
import { releasePluginBuildLock } from "../../../../../packages/ttsc/src/plugin/internal/source/releasePluginBuildLock";
import { TestProject } from "../../../../utils/src/TestProject";

/**
 * Protocol initialization accepts only a recognized persistent v3 layout.
 *
 * @evidence contracts/testing.md#behavioral-verification Actual acquisition publishes the v3 marker, denies a second live acquisition and preserves that root after release/reacquisition. A nonempty foreign protocol directory causes actual native rename failure without a lease or foreign-byte deletion. The destination-occupancy classifier uses actual absent/present paths independently of protocol recognition.
 * @evidence contracts/testing.md#independent-expectations Literal marker bytes, a foreign sentinel, null second acquisition, preserved directory listing and zero abandoned sibling candidates define the expectations. Authored errno objects test classification only and are never substituted for an actual rename result.
 * @evidence contracts/testing.md#distinguishing-cases Absent destination, valid v3 layout and foreign marker distinguish occupancy from recognition. EPERM/EACCES require actual destination presence while EEXIST/ENOTEMPTY alone classify occupancy. Foreign contents remain intact after real native rejection. Native permission denial and simultaneous initialization are not certified by these sequential rows.
 * @evidence contracts/testing.md#execution-ownership Actual source lock owner and native filesystem operate directly in process on two temporary lock identities. No compiler, Node child, fake filesystem, method replacement or OS permission mutation is used. Existing lock owners retain stale-generation/observer/pruning coverage; a separate bounded scratch experiment may observe actual simultaneous initialization.
 */
export function test_plugin_lock_protocol_initialization_preserves_existing_layouts(): void {
  const root = TestProject.tmpdir("ttsc-protocol-layout-");
  const lock = path.join(root, "normal.lock");
  const protocol = PluginBuildLockProtocol.pluginBuildLockProtocolDir(lock);
  for (const code of ["EPERM", "EACCES"])
    assert.equal(
      PluginBuildLockProtocol.isRenameDestinationOccupied({ code }, protocol),
      false,
    );
  assert.equal(
    PluginBuildLockProtocol.isPluginBuildLockProtocolV3(protocol),
    false,
  );
  const original = acquirePluginBuildLock(lock);
  assert.ok(original);
  try {
    assert.equal(
      fs.readFileSync(path.join(protocol, "protocol-v3"), "utf8"),
      "ttsc-plugin-build-lock-v3\n",
    );
    assert.equal(
      PluginBuildLockProtocol.isPluginBuildLockProtocolV3(protocol),
      true,
    );
    for (const code of ["EPERM", "EACCES", "EEXIST", "ENOTEMPTY"])
      assert.equal(
        PluginBuildLockProtocol.isRenameDestinationOccupied({ code }, protocol),
        true,
      );
    assert.equal(acquirePluginBuildLock(lock), null);
  } finally {
    releasePluginBuildLock(lock, original);
  }
  assert.equal(
    PluginBuildLockProtocol.isPluginBuildLockProtocolV3(protocol),
    true,
  );
  const next = acquirePluginBuildLock(lock);
  assert.ok(next);
  try {
    assert.notEqual(next.generation, original.generation);
    assert.equal(
      fs.readFileSync(path.join(protocol, "protocol-v3"), "utf8"),
      "ttsc-plugin-build-lock-v3\n",
    );
  } finally {
    releasePluginBuildLock(lock, next);
  }
  const foreignLock = path.join(root, "foreign.lock");
  const foreign =
    PluginBuildLockProtocol.pluginBuildLockProtocolDir(foreignLock);
  fs.mkdirSync(foreign);
  fs.writeFileSync(path.join(foreign, "protocol-v3"), "foreign protocol\n");
  fs.writeFileSync(path.join(foreign, "sentinel"), "must remain\n");
  assert.equal(
    PluginBuildLockProtocol.isRenameDestinationOccupied(
      { code: "EPERM" },
      foreign,
    ),
    true,
  );
  assert.equal(
    PluginBuildLockProtocol.isPluginBuildLockProtocolV3(foreign),
    false,
  );
  assert.throws(() => acquirePluginBuildLock(foreignLock));
  assert.deepEqual(fs.readdirSync(foreign).sort(), ["protocol-v3", "sentinel"]);
  assert.equal(
    fs.readFileSync(path.join(foreign, "protocol-v3"), "utf8"),
    "foreign protocol\n",
  );
  assert.equal(
    fs.readFileSync(path.join(foreign, "sentinel"), "utf8"),
    "must remain\n",
  );
  assert.deepEqual(
    fs.readdirSync(root).filter((name) => name.includes(".candidate-")),
    [],
  );
}
