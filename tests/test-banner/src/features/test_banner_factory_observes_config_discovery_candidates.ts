import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type createBanner from "../../../../packages/banner/src/index";

/**
 * Verifies the banner factory observes every discovery candidate through the
 * first directory that holds a config file.
 *
 * Native discovery picks the nearest directory containing one of seven
 * `banner.config.*` names and treats a directory wearing such a name as absent.
 * The descriptor must therefore report the whole probed set, including absent
 * names and the directory impostor, so a host can invalidate a generation when
 * a nearer config appears. An explicit `configFile` replaces discovery by one
 * observed path, and the host's `pluginConfigDir` anchor outranks the tsconfig
 * directory.
 *
 * 1. Build a project whose nested directory holds a directory named
 *    `banner.config.ts` and whose parent holds `banner.config.json`.
 * 2. Discover from the nested tsconfig and assert the fourteen probed paths in
 *    native order, the file digest, the directory marker digest and nulls.
 * 3. Re-anchor through `pluginConfigDir` and an absolute `configFile`, and assert
 *    the walk then starts at, or stops on, the named location.
 * 4. Create a nearer config, change its bytes without changing their length, and
 *    add a sibling candidate; assert each observation reflects that state.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls createBanner without configFile and asserts hostInputs, hostInputHashes and hostInputRealpaths for a two-level walk; the descriptor must stop at the first directory that holds a real config file and must treat the directory-shaped candidate as unread bytes with a marker digest. Repeated calls after creating and editing a nearer config and adding a sibling must observe the new bytes and retain every sibling candidate.
 * @evidence contracts/testing.md#independent-expectations Digests are computed with node:crypto over literal bytes and the documented marker string, the candidate order is the authored seven-name list, and the physical target of the directory candidate is the junction target the test created, none of it read back from the factory.
 * @evidence contracts/testing.md#distinguishing-cases Positive observations (file digest, directory marker, junction target) contrast with absent candidates reporting null. An anchor override changes the starting directory and anchors a relative explicit path; an absolute configFile yields exactly one observed path. Creating a nearer config shortens discovery, an equal-length content edit changes its digest, and a sibling config remains observed for native ambiguity validation rather than being omitted.
 * @evidence contracts/testing.md#execution-ownership The matching src/features function runs the authored factory in the source-unit Node process over a temporary directory removed in finally; no config is evaluated, no native code is built and no product host starts.
 */
export function test_banner_factory_observes_config_discovery_candidates(): void {
  const root = fs.realpathSync.native(
    fs.mkdtempSync(path.join(os.tmpdir(), "ttsc-banner-discovery-")),
  );
  try {
    const filename = fileURLToPath(
      new URL("../../../../packages/banner/src/index.ts", import.meta.url),
    );
    const dirname = path.dirname(filename);
    const factory = (
      createRequire(import.meta.url)(filename) as {
        default: typeof createBanner;
      }
    ).default;

    const project = path.join(root, "project");
    const nested = path.join(project, "nested");
    const decoyTarget = path.join(root, "decoy-target");
    fs.mkdirSync(nested, { recursive: true });
    fs.mkdirSync(decoyTarget);
    fs.writeFileSync(path.join(root, "banner.config.mjs"), "grandparent");
    fs.writeFileSync(
      path.join(project, "banner.config.json"),
      '{"text":"parent"}',
    );
    fs.symlinkSync(
      decoyTarget,
      path.join(nested, "banner.config.ts"),
      "junction",
    );
    const names = [
      "banner.config.json",
      "banner.config.js",
      "banner.config.cjs",
      "banner.config.mjs",
      "banner.config.ts",
      "banner.config.cts",
      "banner.config.mts",
    ];
    const sha256 = (value: string): string =>
      crypto.createHash("sha256").update(value).digest("hex");
    const context = {
      binary: "",
      cwd: nested,
      dirname,
      filename,
      projectRoot: nested,
      tsconfig: path.join(nested, "tsconfig.json"),
    };
    const entry = { transform: "@ttsc/banner" };

    const discovered = factory({ ...context, plugin: entry });
    const expectedInputs = [nested, project].flatMap((directory) =>
      names.map((name) => path.join(directory, name)),
    );
    assert.deepEqual(discovered.hostInputs, expectedInputs);
    const hashes: Record<string, string | null> = {};
    const realpaths: Record<string, string | null> = {};
    for (const input of expectedInputs) {
      hashes[input] = null;
      realpaths[input] = null;
    }
    hashes[path.join(nested, "banner.config.ts")] = sha256(
      "ttsc:host-input:directory\0",
    );
    realpaths[path.join(nested, "banner.config.ts")] = decoyTarget;
    hashes[path.join(project, "banner.config.json")] =
      sha256('{"text":"parent"}');
    realpaths[path.join(project, "banner.config.json")] = path.join(
      project,
      "banner.config.json",
    );
    assert.deepEqual(discovered.hostInputHashes, hashes);
    assert.deepEqual(discovered.hostInputRealpaths, realpaths);

    const anchored = factory({
      ...context,
      pluginConfigDir: project,
      plugin: entry,
    });
    assert.deepEqual(
      anchored.hostInputs,
      names.map((name) => path.join(project, name)),
    );

    const explicit = path.join(root, "banner.config.mjs");
    const absolute = factory({
      ...context,
      plugin: { ...entry, configFile: explicit },
    });
    assert.deepEqual(absolute.hostInputs, [explicit]);
    assert.deepEqual(absolute.hostInputHashes, {
      [explicit]: sha256("grandparent"),
    });
    assert.deepEqual(absolute.hostInputRealpaths, { [explicit]: explicit });

    const relative = factory({
      ...context,
      pluginConfigDir: project,
      plugin: { ...entry, configFile: "./banner.config.json" },
    });
    const parentConfig = path.join(project, "banner.config.json");
    assert.deepEqual(relative.hostInputs, [parentConfig]);
    assert.deepEqual(relative.hostInputHashes, {
      [parentConfig]: sha256('{"text":"parent"}'),
    });
    assert.deepEqual(relative.hostInputRealpaths, {
      [parentConfig]: parentConfig,
    });

    const nearerConfig = path.join(nested, "banner.config.json");
    fs.writeFileSync(nearerConfig, '{"text":"near-a"}');
    const nearer = factory({ ...context, plugin: entry });
    assert.deepEqual(
      nearer.hostInputs,
      names.map((name) => path.join(nested, name)),
    );
    assert.equal(
      nearer.hostInputHashes?.[nearerConfig],
      sha256('{"text":"near-a"}'),
    );
    assert.equal(nearer.hostInputRealpaths?.[nearerConfig], nearerConfig);
    assert.equal(nearer.hostInputHashes?.[parentConfig], undefined);

    fs.writeFileSync(nearerConfig, '{"text":"near-b"}');
    const edited = factory({ ...context, plugin: entry });
    assert.deepEqual(edited.hostInputs, nearer.hostInputs);
    assert.equal(
      edited.hostInputHashes?.[nearerConfig],
      sha256('{"text":"near-b"}'),
    );

    const siblingConfig = path.join(nested, "banner.config.cjs");
    fs.writeFileSync(siblingConfig, "module.exports = { text: 'sibling' };");
    const siblings = factory({ ...context, plugin: entry });
    assert.deepEqual(siblings.hostInputs, nearer.hostInputs);
    assert.equal(
      siblings.hostInputHashes?.[siblingConfig],
      sha256("module.exports = { text: 'sibling' };"),
    );
    assert.equal(siblings.hostInputRealpaths?.[siblingConfig], siblingConfig);
    assert.equal(
      siblings.hostInputHashes?.[nearerConfig],
      sha256('{"text":"near-b"}'),
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}
