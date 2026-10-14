import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { readProjectConfig } from "../../../../../packages/ttsc/src/compiler/internal/project/readProjectConfig";
import { PluginPackageResolution } from "../../../../../packages/ttsc/src/plugin/internal/load/PluginPackageResolution";
import { ProjectPluginEntries } from "../../../../../packages/ttsc/src/plugin/internal/load/ProjectPluginEntries";
import { collectProjectHostInputs } from "../../../../../packages/ttsc/src/plugin/internal/load/collectProjectHostInputs";
import { hasProjectPluginEntries } from "../../../../../packages/ttsc/src/plugin/internal/load/hasProjectPluginEntries";
import { loadProjectPlugins } from "../../../../../packages/ttsc/src/plugin/internal/load/loadProjectPlugins";
import { TestProject } from "../../../../utils/src/TestProject";

/**
 * Verifies plugin consumers stay anchored at their selected config directory.
 *
 * A common source root owns sibling source membership, while the selected package owns dependencies. Generated wrappers declare that consumer through pluginConfigDir; inherited relative entries retain their declaring config.
 *
 * 1. Resolve discovered, configured and explicit entries below a wider root.
 * 2. Preserve inherited relative bases, explicit origins and native link paths.
 * 3. Observe consumer manifests and their changes without evaluating descriptors.
 * 4. Keep empty and disabled selection separate from malformed discovery.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls actual entry, presence and input collectors on real configs and package manifests, checks exact resolution bases and selected physical files, then loads no-plugin and disabled-plugin projects to assert current host-input hashes and discovery errors.
 * @evidence contracts/testing.md#independent-expectations Authored package locations define expected directories independently of selection helpers; native realpath defines linked identities and SHA-256 over authored manifest bytes defines fingerprints. A malformed wider-root manifest must be unconsulted while a nearer consumer manifest owns discovery.
 * @evidence contracts/testing.md#distinguishing-cases Covers omitted and explicit roots, discovery, configured bare and inherited relative entries, explicit bare/relative/absolute arrays, empty and false selection, disabled automatic markers, relative explicit wrapper origins, config links, manifest mutation, and malformed selected consumer manifests. Descriptor bodies throw if evaluated; actual descriptor factories and native sibling transforms belong to E2E acceptance.
 * @evidence contracts/testing.md#execution-ownership The selectable async source unit invokes production owners directly on a private filesystem, with no installed consumer, descriptor subprocess, native artifact or compiler host. Loader cases select no enabled entries and exit before evaluation; finally removes every authored file.
 */
export async function test_plugin_resolution_keeps_consumer_config_separate_from_source_root(): Promise<void> {
  const root = TestProject.physicalPath(
    TestProject.tmpdir("ttsc-plugin-consumer-anchor-"),
  );
  const consumer = path.join(root, "apps", "backend");
  const base = path.join(root, "config");
  const overlay = path.join(root, "generated");
  const dependency = path.join(consumer, "node_modules", "consumer-plugin");
  const config = path.join(consumer, "tsconfig.dev.json");
  const manifest = path.join(consumer, "package.json");
  const descriptor = path.join(dependency, "descriptor.cjs");
  const automatic = { transform: "./descriptor.cjs" };
  const configured = [
    { transform: "consumer-plugin" },
    { transform: "./relative.cjs" },
  ];
  const write = (file: string, value: unknown): void => {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(value), "utf8");
  };
  const digest = (bytes: string): string =>
    crypto.createHash("sha256").update(bytes).digest("hex");
  try {
    write(manifest, { dependencies: { "consumer-plugin": "1.0.0" } });
    write(path.join(dependency, "package.json"), {
      name: "consumer-plugin",
      main: "descriptor.cjs",
      ttsc: { plugin: automatic },
    });
    fs.writeFileSync(
      descriptor,
      'throw new Error("selection evaluated descriptor");',
    );
    fs.writeFileSync(path.join(root, "package.json"), "malformed unused root");
    write(config, {});
    for (const sourceRoot of [undefined, root, "."]) {
      const project = readProjectConfig({
        cwd: root,
        tsconfig: config,
        projectRoot: sourceRoot,
      });
      assert.equal(project.root, sourceRoot === undefined ? consumer : root);
      assert.equal(
        ProjectPluginEntries.resolvePluginBaseDir(project),
        consumer,
      );
      assert.deepEqual(ProjectPluginEntries.resolvePluginEntries(project), [
        { baseDir: dependency, config: automatic },
      ]);
      assert.equal(hasProjectPluginEntries(project), true);
      const inputs = collectProjectHostInputs(project);
      assert.ok(inputs.includes(manifest));
      assert.ok(inputs.includes(path.join(dependency, "package.json")));
      assert.equal(inputs.includes(path.join(root, "package.json")), false);
      assert.deepEqual(
        ProjectPluginEntries.resolvePluginEntries(project, []),
        [],
      );
      assert.equal(hasProjectPluginEntries(project, false), false);
      assert.equal(hasProjectPluginEntries(project, []), false);
      for (const transform of ["consumer-plugin", "./local.cjs", descriptor]) {
        assert.deepEqual(
          ProjectPluginEntries.resolvePluginEntries(project, [{ transform }]),
          [{ baseDir: consumer, config: { transform } }],
        );
      }
      assert.equal(
        PluginPackageResolution.resolvePluginRequest(
          "consumer-plugin",
          consumer,
        ),
        descriptor,
      );
    }
    write(path.join(base, "tsconfig.json"), {
      compilerOptions: { plugins: configured },
    });
    write(config, { extends: "../../config/tsconfig.json" });
    const inherited = readProjectConfig({
      cwd: root,
      tsconfig: config,
      projectRoot: root,
    });
    assert.deepEqual(ProjectPluginEntries.resolvePluginEntries(inherited), [
      { baseDir: consumer, config: configured[0] },
      { baseDir: base, config: configured[1] },
    ]);
    const wrapper = path.join(overlay, "tsconfig.json");
    write(wrapper, { extends: "../apps/backend/tsconfig.dev.json" });
    const wrapped = readProjectConfig({
      cwd: root,
      tsconfig: wrapper,
      projectRoot: root,
    });
    const origin = path.relative(root, consumer);
    assert.equal(hasProjectPluginEntries(wrapped, undefined, origin), true);
    assert.deepEqual(
      ProjectPluginEntries.resolvePluginEntries(wrapped, undefined, origin),
      [
        { baseDir: consumer, config: configured[0] },
        { baseDir: base, config: configured[1] },
      ],
    );
    assert.deepEqual(
      ProjectPluginEntries.resolvePluginEntries(
        wrapped,
        [{ transform: "./local.cjs" }],
        origin,
      ),
      [{ baseDir: consumer, config: { transform: "./local.cjs" } }],
    );
    assert.ok(
      collectProjectHostInputs(wrapped, true, origin).includes(manifest),
    );
    const alias = path.join(root, "linked-backend");
    fs.symlinkSync(
      consumer,
      alias,
      process.platform === "win32" ? "junction" : "dir",
    );
    const linked = readProjectConfig({
      cwd: root,
      tsconfig: path.join(alias, "tsconfig.dev.json"),
      projectRoot: root,
    });
    assert.equal(ProjectPluginEntries.resolvePluginBaseDir(linked), consumer);

    write(config, {});
    write(manifest, {});
    fs.writeFileSync(
      path.join(overlay, "package.json"),
      "malformed unused wrapper",
    );
    for (const tsconfig of [config, wrapper]) {
      const initial = await loadProjectPlugins({
        binary: "",
        cwd: root,
        tsconfig,
        projectRoot: root,
        ...(tsconfig === wrapper ? { pluginConfigDir: origin } : {}),
      });
      assert.deepEqual(initial.nativePlugins, []);
      assert.equal(initial.project.root, root);
      assert.equal(initial.hostInputHashes[manifest], digest("{}"));
      assert.equal(
        initial.hostInputs.includes(path.join(root, "package.json")),
        false,
      );
      assert.equal(
        initial.hostInputs.includes(path.join(overlay, "package.json")),
        false,
      );
    }
    const disabled = { dependencies: { "consumer-plugin": "1.0.0" } };
    write(path.join(dependency, "package.json"), {
      name: "consumer-plugin",
      main: "descriptor.cjs",
      ttsc: { plugin: { ...automatic, enabled: false } },
    });
    write(manifest, disabled);
    const changed = await loadProjectPlugins({
      binary: "",
      cwd: root,
      tsconfig: config,
      projectRoot: root,
    });
    assert.deepEqual(changed.nativePlugins, []);
    assert.equal(
      changed.hostInputHashes[manifest],
      digest(JSON.stringify(disabled)),
    );
    assert.ok(
      changed.hostInputs.includes(path.join(dependency, "package.json")),
    );
    fs.writeFileSync(manifest, "malformed selected consumer");
    await assert.rejects(
      async () =>
        loadProjectPlugins({
          binary: "",
          cwd: root,
          tsconfig: config,
          projectRoot: root,
        }),
      (error: unknown) =>
        error instanceof Error && error.message.includes(manifest),
    );
    const bypassed = await loadProjectPlugins({
      binary: "",
      cwd: root,
      tsconfig: config,
      projectRoot: root,
      entries: [],
    });
    assert.deepEqual(bypassed.nativePlugins, []);
    assert.equal(bypassed.hostInputs.includes(manifest), false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}
