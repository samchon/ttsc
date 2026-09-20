import ttsc from "@ttsc/unplugin/bun";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { landLateRace, projectAt, valuesIn } from "./common.mjs";
import { runScenarios } from "./scenarios.mjs";

/**
 * The Bun half of the host matrix, in a Bun process: one `Bun.build` per
 * scenario step on the fixture the Node worker created, through one plugin
 * instance, so each build compiles once for the four modules and releases its
 * generation at completion.
 *
 * Bun offers no seam after a module's loader, as esbuild does not; the seam
 * after ttsc is the resolution of the module's imports.
 */
const [root, linked] = process.argv.slice(2);
const project = projectAt(root, { linked: linked === "linked" });
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
await runScenarios(project, session);

// The preload session owns a different cache lifetime: each `bun run` is one
// immutable load session.
fs.writeFileSync(
  path.join(project.root, "bunfig.toml"),
  'preload = ["@ttsc/unplugin/bun-register"]\n',
);
const run = (args) =>
  Bun.spawnSync(["bun", ...args], { cwd: project.root, env: process.env });
project.break();
const broken = run(["run", "src/main.ts"]);
assert.notEqual(broken.exitCode, 0);
assert.match(
  `${broken.stdout}${broken.stderr}`,
  /invalid contract type/,
  "a broken input fails a runtime session",
);
for (const value of ["RUNTIME_FIRST", "RUNTIME_SECOND"]) {
  project.change(value);
  const ran = run(["run", "src/main.ts"]);
  assert.equal(ran.exitCode, 0, `${ran.stderr}`);
  assert.equal(
    String(ran.stdout).trim(),
    [value, value, value, value].join(" "),
  );
}
