import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { linkVirtualEntry } from "../../../../../packages/ttsc/src/launcher/internal/linkVirtualEntry";
import { TestProject } from "../../../../utils/src/TestProject";

/**
 * Verifies stale directory entries cannot abort layout or hide real IO errors.
 * A directory listing is an observation, not a lease on another owner's file.
 *
 * 1. Enumerate actual files, then unlink two before the mirror consumes them.
 * 2. Require no new output and preserve a neighboring existing destination.
 * 3. Keep destination failures visible and preserve live-file copy semantics.
 *
 * @evidence contracts/testing.md#behavioral-verification Actual native Dirents outlive their removed source files; product mirroring must finish without output or clobbering. A live source with a missing destination parent or directory destination must still throw, and an ordinary occupied-file fallback copies the exact live payload independently.
 * @evidence contracts/testing.md#independent-expectations Explicit unlink establishes source absence; authored source/sentinel bytes define expected preservation, and a deliberately missing parent or directory is independently an invalid file destination. No product metadata or mocked filesystem supplies the oracle.
 * @evidence contracts/testing.md#distinguishing-cases Absent versus occupied destinations for vanished sources contrast live sources with ENOENT destination failures, other destination-kind failures and valid copy fallback. Existing tests own live/dangling symlink routes. The deterministic unlink reproduces the enumeration-to-consumption race without timing or a clock-probe filename exception.
 * @evidence contracts/testing.md#execution-ownership The named source unit uses actual native filesystem operations and the maintained mirror owner in TestProject-owned scratch; no compiler, installer, host or foreign-method replacement runs.
 */
export function test_linkvirtualentry_skips_only_confirmed_vanished_sources(): void {
  const root = TestProject.tmpdir("ttsc-vanished-layout-");
  const source = path.join(root, "source");
  const output = path.join(root, "output");
  fs.mkdirSync(source);
  fs.mkdirSync(output);
  for (const name of ["removed", "occupied", "live"])
    fs.writeFileSync(path.join(source, name), "live payload");
  const entries = new Map(
    fs
      .readdirSync(source, { withFileTypes: true })
      .map((entry) => [entry.name, entry]),
  );
  for (const name of ["removed", "occupied"]) {
    const real = path.join(source, name);
    const virtual = path.join(output, name);
    if (name === "occupied") fs.writeFileSync(virtual, "preserved sentinel");
    const entry = entries.get(name)!;
    assert.equal(entry.isFile(), true);
    fs.unlinkSync(real);
    assert.throws(() => fs.lstatSync(real), { code: "ENOENT" });
    assert.doesNotThrow(() => linkVirtualEntry(real, virtual, entry));
    if (name === "occupied")
      assert.equal(fs.readFileSync(virtual, "utf8"), "preserved sentinel");
    else assert.equal(fs.existsSync(virtual), false);
  }
  const real = path.join(source, "live");
  const entry = entries.get("live")!;
  assert.throws(
    () => linkVirtualEntry(real, path.join(output, "absent", "live"), entry),
    { code: "ENOENT" },
  );
  assert.equal(fs.existsSync(path.join(output, "absent")), false);
  const directory = path.join(output, "directory");
  fs.mkdirSync(directory);
  assert.throws(() => linkVirtualEntry(real, directory, entry));
  assert.deepEqual(fs.readdirSync(directory), []);
  const copied = path.join(output, "copied");
  fs.writeFileSync(copied, "stale bytes");
  linkVirtualEntry(real, copied, entry);
  assert.equal(fs.readFileSync(copied, "utf8"), "live payload");
  fs.writeFileSync(copied, "independent bytes");
  assert.equal(fs.readFileSync(real, "utf8"), "live payload");
}
