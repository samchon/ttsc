import { TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import type { TtscWatchInput } from "../../../../../packages/unplugin/lib/core/transform/watch/TtscWatchInput.mjs";
import { createRealNativeEnvelopeFixture } from "../../internal/real-native-envelope/createRealNativeEnvelopeFixture";

/**
 * Verifies every input handed to a host is spelled under the project as the
 * host spelled the module it delivered, when the project is reached through a
 * link, and that each input is handed once (samchon/ttsc#1451).
 *
 * The compiler reports its inputs physically, after every link, while a host
 * names the project one of two ways: by the path it was given, as Turbopack
 * does, or by the physical path its resolver arrives at, as webpack does. On
 * macOS every temporary directory is a link, `/var/…` to `/private/var/…`, and
 * a linked workspace is one anywhere. A build host compares the two lexically:
 * Turbopack refused every dependency as leaving its root, so it tracked none,
 * and webpack's snapshots watched every project directory under both spellings.
 * The module the host delivers says which spelling it uses. Measured on the
 * first macOS runs of the whole suite (runs 35478519798 and 35482948927).
 *
 * 1. Create a real project and a link to it, and deliver a module through the link
 *    with the registration hook.
 * 2. Assert every input below the project is spelled under the link, none under
 *    the physical directory, each still carries its identity, and the selected
 *    config is handed once, though the compiler and the selection both name
 *    it.
 * 3. Deliver the module by its physical path, and assert every input below the
 *    project is spelled physically, none under the link.
 * 4. Break a declaration so the compile fails, deliver through the link again, and
 *    assert the failed registration is spelled the same way.
 */
export async function test_transformttsc_hands_the_host_its_own_project_spelling(): Promise<void> {
  const api = await TestUnpluginRuntime.loadUnpluginApi();
  const fixture = createRealNativeEnvelopeFixture();
  const physical = fs.realpathSync.native(fixture.root);
  const linkRoot = fs.mkdtempSync(path.join(os.tmpdir(), "ttsc-link-"));
  const linked = path.join(linkRoot, "project");
  fs.symlinkSync(
    physical,
    linked,
    process.platform === "win32" ? "junction" : "dir",
  );
  const options = api.resolveOptions({
    project: path.join(linked, "tsconfig.json"),
  });
  const under = (root: string) => (input: TtscWatchInput) =>
    input.file === root || input.file.startsWith(`${root}${path.sep}`);
  const deliver = async (
    root: string,
  ): Promise<{
    error: unknown;
    registered: TtscWatchInput[];
  }> => {
    const cache = api.createTtscTransformCache();
    api.beginTtscTransformBuild(cache);
    const registered: TtscWatchInput[] = [];
    const module = path.join(root, "src", path.basename(fixture.modules[0]!));
    let error: unknown;
    try {
      await api.transformTtsc(
        module,
        fs.readFileSync(module, "utf8"),
        options,
        undefined,
        cache,
        {
          addWatchFiles: (inputs: readonly TtscWatchInput[]) => {
            registered.push(...inputs);
          },
        },
      );
    } catch (caught) {
      error = caught;
    }
    return { error, registered };
  };
  const assertSpelledUnder = (
    registered: TtscWatchInput[],
    root: string,
    other: string,
    label: string,
  ): void => {
    assert.ok(registered.length > 0, `${label}: inputs registered`);
    assert.ok(
      registered.some(under(root)),
      `${label}: the project's inputs are registered under ${root}`,
    );
    assert.deepEqual(
      registered.filter(under(other)).map((input) => input.file),
      [],
      `${label}: no input is spelled under ${other}`,
    );
  };

  const healthy = await deliver(linked);
  assert.equal(healthy.error, undefined, "the fixture compiles");
  assertSpelledUnder(healthy.registered, linked, physical, "a linked delivery");
  assert.ok(
    healthy.registered
      .filter(under(linked))
      .every((input) => input.evidence?.identity !== undefined),
    "each input keeps its identity",
  );
  assert.deepEqual(
    healthy.registered
      .map((input) => input.file)
      .filter((file) => file === path.join(linked, "tsconfig.json")),
    [path.join(linked, "tsconfig.json")],
    "the selected config is handed once",
  );

  const resolved = await deliver(physical);
  assert.equal(resolved.error, undefined, "the fixture compiles");
  assertSpelledUnder(
    resolved.registered,
    physical,
    linked,
    "a physical delivery",
  );

  fs.writeFileSync(
    fixture.declaration,
    "export interface Shared { label: NotARealExternalType; }\n",
    "utf8",
  );
  const failed = await deliver(linked);
  assert.ok(failed.error !== undefined, "the broken declaration fails");
  assertSpelledUnder(failed.registered, linked, physical, "a failed delivery");
}
