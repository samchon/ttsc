import { test_host_bun_preload_runtime } from "./scenarios/test_host_bun_preload_runtime.mjs";
import ttsc from "@ttsc/unplugin/bun";
import assert from "node:assert/strict";

import { landLateRace, projectAt, valuesIn } from "./common.mjs";
import { runScenarios, SCENARIOS } from "./scenarios.mjs";

/**
 * The Bun half of the host matrix, in a Bun process: one `Bun.build` per
 * scenario step on the fixture the Node worker created, through one plugin
 * instance, so each build compiles once for the four modules and releases its
 * generation at completion.
 *
 * Bun offers no seam after a module's loader, as esbuild does not; the seam
 * after ttsc is the resolution of the module's imports.
 */
const [root, linked, transformPlugin, contract = "complete"] = process.argv.slice(2);
const project = projectAt(root, {
  linked: linked === "linked",
  plugin: transformPlugin,
});
const plugin = ttsc(project.options);
const build = () =>
  Bun.build({
    entrypoints: [project.entry],
    plugins: [
      plugin,
      {
        name: "race-after-ttsc",
        setup(build) {
          build.onResolve({ filter: /^\.\/mod\d\.ts$/ }, () => {
            landLateRace(project.root);
            return undefined;
          });
        },
      },
    ],
    target: "bun",
    throw: false,
  });
const session = {
  name: "bun",
  exactRuns: true,
  lateRace: true,
  membership: false,
  async settled(label, value) {
    // A Bun build reads the state as it is; a race edit lands during it, and
    // the next build reads the settled state.
    for (let attempt = 0; ; attempt++) {
      const result = await build();
      assert.equal(
        result.success,
        true,
        `bun ${label}: ${result.logs.join("\n")}`,
      );
      const code = await result.outputs[0].text();
      const values = valuesIn(code);
      if (values.length === 4 && values.every((found) => found === value))
        return;
      assert.ok(
        attempt < 2,
        `bun ${label}: converged on ${JSON.stringify(values)}`,
      );
    }
  },
  async failed(label, pattern) {
    const result = await build();
    assert.equal(result.success, false, `bun ${label}: the build fails`);
    assert.match(result.logs.join("\n"), pattern);
  },
};
await runScenarios(project, session, contract === "complete" ? SCENARIOS : SCENARIOS.slice(0, 4));

await test_host_bun_preload_runtime(project);
