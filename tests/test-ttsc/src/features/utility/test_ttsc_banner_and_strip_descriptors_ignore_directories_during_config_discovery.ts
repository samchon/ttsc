import type createBanner from "../../../../../packages/banner/src/index";
import type createStrip from "../../../../../packages/strip/src/index";

import { TestProject } from "../../../../utils/src/TestProject";
import assert from "node:assert/strict";
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
 *
 * @evidence contracts/testing.md#behavioral-verification Calls the authored banner and strip descriptor factories and asserts candidate traversal, a candidate-directory fingerprint, selected ancestor retention and stopping beyond that ancestor; a walk that treats a directory as config cannot pass.
 * @evidence contracts/testing.md#independent-expectations The public discovery contract chooses config files, not directories; the fixture independently supplies the nearer directory and ancestor file, with literal presence/absence and SHA-256 shape expectations.
 * @evidence contracts/testing.md#distinguishing-cases For both the banner and the strip factory, a directory named `<plugin>.config.ts` in the project is recorded but does not stop the walk, the `<plugin>.config.json` file in the workspace above is recorded as the selected config, and the same-named path above the workspace is not recorded. Executable configs and a configFile override are not exercised.
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
    }
}
