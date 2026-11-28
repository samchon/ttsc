import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

import { TestProject } from "../../../../utils/src/TestProject";
import { assert, fs, path, workspaceRoot } from "../../internal/script-unit";

/**
 * Verifies isolated Node package lookup keeps conditions and omits preloads.
 *
 * 1. Supply different condition and preload flags through argv and NODE_OPTIONS.
 * 2. Ask the real worker to resolve two conditional package exports.
 * 3. Verify only the caller ran either preload and both conditions still select.
 *
 * @evidence contracts/testing.md#behavioral-verification The actor uses the maintained lexical observer and Node resolves both native require exports with a V8 startup flag on the actor.
 * @evidence contracts/testing.md#independent-expectations Two independently authored exports identify each condition and the preload marker records every actual evaluation.
 * @evidence contracts/testing.md#distinguishing-cases Separate environment and CLI conditions retain distinct export branches. A preload at either position would append a second marker.
 * @evidence contracts/testing.md#execution-ownership The unit uses a bounded Node actor and owns its project and preload files. It does not change the unit runner's environment or run Go.
 */
export function test_lexical_package_worker_keeps_conditions_without_replaying_preloads(): void {
  const root = TestProject.tmpdir("ttsc-lexical-worker-");
  const preset = path.join(root, "node_modules", "preset");
  const marker = path.join(root, "preloads.txt");
  const preloads = ["environment", "argv"].map((source) => {
    const file = path.join(root, `${source}.cjs`);
    fs.writeFileSync(
      file,
      `require("node:fs").appendFileSync(${JSON.stringify(marker)}, ${JSON.stringify(`${source}\n`)});`,
    );
    return file;
  });
  fs.mkdirSync(preset, { recursive: true });
  fs.writeFileSync(
    path.join(preset, "package.json"),
    JSON.stringify({
      exports: {
        "./env": { "env condition": "./env.json", default: "./default.json" },
        "./cli": { "cli-condition": "./cli.json", default: "./default.json" },
      },
    }),
  );
  for (const name of ["env", "cli", "default"])
    fs.writeFileSync(path.join(preset, `${name}.json`), "{}");
  const observer = path.join(
    workspaceRoot,
    "packages/ttsc/src/compiler/internal/project/observeLexicalPackagePath.ts",
  );
  const from = path.join(root, "tsconfig.json");
  const actor = path.join(root, "actor.cjs");
  fs.writeFileSync(
    actor,
    `const { observeLexicalPackagePath } = require(${JSON.stringify(observer)});
    process.stdout.write(JSON.stringify(["preset/env", "preset/cli"].map((specifier) => observeLexicalPackagePath(${JSON.stringify(from)}, specifier))));`,
  );
  const result = spawnSync(
    process.execPath,
    [
      "--max-old-space-size=512",
      "--conditions=cli-condition",
      "--require",
      preloads[1]!,
      "--import",
      pathToFileURL(path.join(workspaceRoot, "config/register-unit-loader.mjs"))
        .href,
      actor,
    ],
    {
      env: {
        ...process.env,
        NODE_OPTIONS: `--conditions="env condition" --require=${JSON.stringify(preloads[0])}`,
      },
      encoding: "utf8",
      timeout: 15_000,
    },
  );
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(
    JSON.parse(result.stdout),
    ["env", "cli"].map((name) => path.join(preset, `${name}.json`)),
  );
  assert.equal(fs.readFileSync(marker, "utf8"), "environment\nargv\n");
}
