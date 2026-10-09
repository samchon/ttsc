import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { TestProject } from "../../../utils/src/TestProject";
import { createViteBuildControl } from "../../../utils/src/unplugin/createViteBuildControl";

/**
 * Verifies Vite operational storage ends only with its original ownership.
 *
 * The same allocation and release operation used by the Vite parent runs on
 * real ignored directories. Retirement and restoration remain explicit caller
 * facts; these cases do not fabricate a native join or run another Vite host.
 *
 * 1. Release joined and not-started controls after complete restoration.
 * 2. Retain unknown lifetimes, failed restoration and changed native identities.
 * 3. Preserve parent, sibling and linked-target bytes during exact-leaf removal.
 * 4. Refuse unignored or relative parents before allocating storage.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls actual createViteBuildControl and its release operation on native directories, checking receipt bytes survive refusal and the exact leaf disappears after safe release. A real exclusive-write setup failure still permits not-started release.
 * @evidence contracts/testing.md#independent-expectations An original actor's receipts remain readable until retirement and every restoration finish. Literal sentinel bytes, native directory identities and independent exists/read observations distinguish deletion, retention and foreign-occupant preservation.
 * @evidence contracts/testing.md#distinguishing-cases Joined and not-started release contrast with unknown lifetime for both restoration values and incomplete restoration for both known lifetimes. Replaced and linked roots refuse release; a nested directory link preserves its sibling target. Multiple allocations preserve their common parent and sibling bytes, and invalid parents create nothing. Independent cases retain their own failures.
 * @evidence contracts/testing.md#execution-ownership One normally discoverable test-unplugin unit executes the shared filesystem owner in process. Git ignore checks start only the ordinary Git metadata command; no compiler, installation, product host, native supervisor or extra Vite preparation runs. All synchronous fixture operations finish before exact owned-parent cleanup; native retirement authority and the ordinary Vite connection remain E2E-owned.
 */
export function test_vite_build_control_releases_only_restored_retired_allocations(): void {
  const failures: unknown[] = [];
  for (const scenario of [
    "joined",
    "not-started",
    "unknown-restored",
    "unknown-unrestored",
    "joined-unrestored",
    "not-started-unrestored",
    "replaced",
    "linked",
    "nested-link",
    "invalid-parent",
  ] as const) {
    const parent = path.join(
      TestProject.WORKSPACE_ROOT,
      ".work",
      "vite-control-unit-" + randomUUID(),
    );
    try {
      if (scenario === "invalid-parent") {
        const unignored = path.join(
          TestProject.WORKSPACE_ROOT,
          "tests",
          "vite-control-unignored-" + randomUUID(),
        );
        assert.throws(() => createViteBuildControl(unignored));
        assert.equal(fs.existsSync(unignored), false);
        assert.throws(
          () => createViteBuildControl(path.relative(process.cwd(), parent)),
          /must be absolute/,
        );
        assert.equal(fs.existsSync(parent), false);
        continue;
      }
      const control = createViteBuildControl(parent);
      const sibling = createViteBuildControl(parent);
      assert.notEqual(control.root, sibling.root);
      const receipt = path.join(control.root, "record-transition.json");
      const siblingReceipt = path.join(sibling.root, "record-transition.json");
      fs.writeFileSync(receipt, "original transition bytes");
      fs.writeFileSync(siblingReceipt, "sibling transition bytes");
      const original = fs.lstatSync(control.root);
      if (scenario === "joined" || scenario === "not-started") {
        if (scenario === "not-started") {
          const request = path.join(control.root, "request.json");
          fs.mkdirSync(request);
          assert.throws(() =>
            fs.writeFileSync(request, "cannot write over a directory", {
              flag: "wx",
            }),
          );
        }
        control.release(scenario, true);
        assert.equal(fs.existsSync(control.root), false);
      } else if (scenario === "replaced" || scenario === "linked") {
        const moved = control.root + "-original";
        fs.renameSync(control.root, moved);
        if (scenario === "linked")
          fs.symlinkSync(
            sibling.root,
            control.root,
            process.platform === "win32" ? "junction" : "dir",
          );
        else {
          fs.mkdirSync(control.root);
          fs.writeFileSync(receipt, "foreign occupant bytes");
        }
        assert.throws(
          () => control.release("joined", true),
          /no longer the owned directory|identity changed/,
        );
        assert.equal(
          fs.readFileSync(path.join(moved, "record-transition.json"), "utf8"),
          "original transition bytes",
        );
        assert.equal(
          fs.readFileSync(receipt, "utf8"),
          scenario === "linked"
            ? "sibling transition bytes"
            : "foreign occupant bytes",
        );
      } else if (scenario === "nested-link") {
        fs.symlinkSync(
          sibling.root,
          path.join(control.root, "sibling-link"),
          process.platform === "win32" ? "junction" : "dir",
        );
        control.release("joined", true);
        assert.equal(fs.existsSync(control.root), false);
      } else {
        const lifetime = scenario.startsWith("unknown")
          ? "unknown"
          : scenario === "joined-unrestored"
            ? "joined"
            : "not-started";
        assert.throws(
          () => control.release(lifetime, scenario === "unknown-restored"),
          /retained pending original retirement and restoration/,
        );
        const retained = fs.lstatSync(control.root);
        assert.equal(retained.dev, original.dev);
        assert.equal(retained.ino, original.ino);
        assert.equal(retained.birthtimeMs, original.birthtimeMs);
        assert.equal(
          fs.readFileSync(receipt, "utf8"),
          "original transition bytes",
        );
      }
      assert.equal(fs.statSync(parent).isDirectory(), true);
      assert.equal(
        fs.readFileSync(siblingReceipt, "utf8"),
        "sibling transition bytes",
      );
    } catch (cause) {
      failures.push(new Error("Vite build control: " + scenario, { cause }));
    } finally {
      try {
        if (fs.existsSync(parent))
          fs.rmSync(parent, { recursive: true });
      } catch (cause) {
        failures.push(new Error("Vite control fixture cleanup: " + scenario, { cause }));
      }
    }
  }
  if (failures.length)
    throw new AggregateError(failures, "Vite build control ownership");
}
