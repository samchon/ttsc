import { TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import type { TtscWatchInput } from "../../../../../packages/unplugin/lib/core/transform/watch/TtscWatchInput.mjs";
import { createRealNativeEnvelopeFixture } from "../../internal/real-native-envelope/createRealNativeEnvelopeFixture";

/**
 * Verifies every input handed to a host is spelled under the project as the
 * host spells it, when the project is reached through a link
 * (samchon/ttsc#1451).
 *
 * The compiler reports its inputs physically, after every link, while a host
 * names the project by the path it was given. On macOS every temporary
 * directory is such a path, `/var/…` linking to `/private/var/…`, and a linked
 * workspace is one anywhere. A build host compares the two lexically: Turbopack
 * refused every dependency as leaving its root, so it tracked none, and
 * webpack's snapshots watched files it never compared. Measured on the first
 * macOS run of the whole suite (run 35478519798).
 *
 * 1. Create a real project and a link to it, and deliver a module through the link
 *    with the registration hook.
 * 2. Assert every input below the project is spelled under the link, none under
 *    the physical directory, and each still carries its identity.
 * 3. Break a declaration so the compile fails, deliver again, and assert the
 *    failed registration is spelled the same way.
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
  const deliver = async (): Promise<{
    error: unknown;
    registered: TtscWatchInput[];
  }> => {
    const cache = api.createTtscTransformCache();
    api.beginTtscTransformBuild(cache);
    const registered: TtscWatchInput[] = [];
    const module = path.join(linked, "src", path.basename(fixture.modules[0]!));
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
  const assertSpelledUnderTheLink = (
    registered: TtscWatchInput[],
    label: string,
  ): void => {
    assert.ok(registered.length > 0, `${label}: inputs registered`);
    assert.ok(
      registered.some(under(linked)),
      `${label}: the project's inputs are registered under the link`,
    );
    assert.deepEqual(
      registered.filter(under(physical)).map((input) => input.file),
      [],
      `${label}: no input is spelled under the physical directory`,
    );
  };

  const healthy = await deliver();
  assert.equal(healthy.error, undefined, "the fixture compiles");
  assertSpelledUnderTheLink(healthy.registered, "a successful delivery");
  assert.ok(
    healthy.registered
      .filter(under(linked))
      .every((input) => input.evidence?.identity !== undefined),
    "each input keeps its identity",
  );

  fs.writeFileSync(
    fixture.declaration,
    "export interface Shared { label: NotARealExternalType; }\n",
    "utf8",
  );
  const failed = await deliver();
  assert.ok(failed.error !== undefined, "the broken declaration fails");
  assertSpelledUnderTheLink(failed.registered, "a failed delivery");
}
