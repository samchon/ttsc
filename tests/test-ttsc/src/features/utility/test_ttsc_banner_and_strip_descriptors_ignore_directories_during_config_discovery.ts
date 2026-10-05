import type createBanner from "../../../../../packages/banner/src/index";
import type createStrip from "../../../../../packages/strip/src/index";

import { TestProject } from "../../../../utils/src/TestProject";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

/**
 * Verifies banner and strip report the same discovery candidates their native
 * config loaders inspect.
 *
 * A directory named like a config is not a native config candidate. The
 * descriptor-side input walk must therefore continue to the selected ancestor
 * file so a persistent bundler generation observes edits to it.
 *
 * 1. Plant a candidate-named directory in a nested project and a real config in
 *    its workspace ancestor.
 * 2. Invoke both package descriptors with that project as the discovery root.
 * 3. Assert each host-input list crosses the directory and stops at the real
 *    selected ancestor.
 * 4. Add a nearer JSON candidate, then override discovery with a custom JSON
 *    configFile in relative and absolute spellings.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls the actual banner and strip descriptor factories and asserts directory-candidate traversal, ancestor selection, nearer JSON stopping and exact custom configFile input selection. Descriptor observations do not evaluate config values or certify native loader acquisition.
 * @evidence contracts/testing.md#independent-expectations The public discovery contract chooses config files, not directories; authored nearer/ancestor populations define presence and stopping. Explicit configFile overrides automatic discovery, so its sole expected input is the authored custom path, with independent SHA-256 over literal bytes and native realpath observation; config values themselves remain unevaluated.
 * @evidence contracts/testing.md#distinguishing-cases For both factories, a directory candidate does not stop the walk, an ancestor JSON does, a later nearer JSON excludes that ancestor, and relative/absolute configFile select only custom JSON with exact content hashes. Executable configs and native config evaluation are not exercised.
 * @evidence contracts/testing.md#execution-ownership Unit test discovered once under src/features/utility; it loads the two TypeScript factories through createRequire and runs discovery over a TestProject.tmpdir containing one directory and one `{}` JSON file per plugin, with no native build, evaluator or product host.
 */
export function test_ttsc_banner_and_strip_descriptors_ignore_directories_during_config_discovery() {
    const workspace = TestProject.tmpdir("ttsc-utility-host-inputs-");
    const project = path.join(workspace, "packages", "app");
    fs.mkdirSync(project, { recursive: true });

    for (const plugin of ["banner", "strip"] as const) {
      const localCandidate = path.join(project, `${plugin}.config.ts`);
      fs.mkdirSync(localCandidate);
      const selected = path.join(workspace, `${plugin}.config.json`);
      fs.writeFileSync(selected, "{}\n", "utf8");

      const filename = path.join(TestProject.WORKSPACE_ROOT, "packages", plugin, "src", "index.ts");
      const factory = (createRequire(import.meta.url)(filename) as { default: typeof createBanner | typeof createStrip }).default;
      const descriptor = factory({
        binary: "",
        cwd: project,
        dirname: path.dirname(filename),
        filename,
        plugin: { transform: `@ttsc/${plugin}` },
        pluginConfigDir: project,
        projectRoot: project,
        tsconfig: path.join(project, "tsconfig.json"),
      });

      assert.ok(descriptor.hostInputs);
      assert.ok(descriptor.hostInputHashes);
      assert.equal(typeof descriptor.hostInputHashes[localCandidate], "string");
      assert.ok(descriptor.hostInputs.includes(localCandidate));
      assert.match(
        descriptor.hostInputHashes[localCandidate] as string,
        /^[0-9a-f]{64}$/,
      );
      assert.ok(descriptor.hostInputs.includes(selected));
      assert.equal(
        descriptor.hostInputs.includes(
          path.join(path.dirname(workspace), `${plugin}.config.json`),
        ),
        false,
      );
      const localJson = path.join(project, `${plugin}.config.json`);
      fs.writeFileSync(localJson, "{}\n", "utf8");
      const context = {
        binary: "", cwd: project, dirname: path.dirname(filename), filename,
        pluginConfigDir: project, projectRoot: project,
        tsconfig: path.join(project, "tsconfig.json"),
      };
      const nearer = factory({ ...context, plugin: { transform: `@ttsc/${plugin}` } });
      assert.equal(nearer.hostInputs.includes(localJson), true);
      assert.equal(nearer.hostInputs.includes(selected), false);
      const customName = `custom-${plugin}.json`;
      const custom = path.join(project, customName);
      const customBytes = '{"ownedCustomConfig":true}\n';
      fs.writeFileSync(custom, customBytes, "utf8");
      for (const configFile of [customName, custom]) {
        const overridden = factory({
          ...context, plugin: { transform: `@ttsc/${plugin}`, configFile },
        });
        assert.deepEqual(overridden.hostInputs, [custom]);
        assert.deepEqual(overridden.hostInputHashes, {
          [custom]: createHash("sha256").update(customBytes).digest("hex"),
        });
        assert.deepEqual(overridden.hostInputRealpaths, {
          [custom]: fs.realpathSync.native?.(custom) ?? fs.realpathSync(custom),
        });
      }
    }
}
