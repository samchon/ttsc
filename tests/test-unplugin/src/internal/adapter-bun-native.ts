import { TestProject, TestUnpluginProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";

/**
 * Run Bun itself so Windows IPC and runtime lifetime contracts cannot be
 * simulated away.
 */
export async function assertBunNativeSessions(): Promise<void> {
  const root = fs.realpathSync.native(TestUnpluginProject.createProject());
  const log = path.join(root, "dist", "compiles.bin");
  fs.mkdirSync(path.dirname(log), { recursive: true });
  const configuration = JSON.parse(
    fs.readFileSync(path.join(root, "tsconfig.json"), "utf8"),
  );
  configuration.compilerOptions.plugins.push({
    transform: "./plugin.cjs",
    name: "runs",
    operation: "count-runs",
    runLog: log,
  });
  fs.writeFileSync(
    path.join(root, "tsconfig.json"),
    JSON.stringify(configuration),
  );
  const library = path.resolve(
    import.meta.dirname,
    "../../../../packages/unplugin/lib",
  );
  TestProject.writeFiles(root, {
    "build.mjs": [
      'import assert from "node:assert/strict";',
      `import ttsc from ${JSON.stringify(pathToFileURL(path.join(library, "bun.mjs")).href)};`,
      "const plugin = ttsc();",
      "for (let pass = 0; pass < 2; pass++) {",
      '  const result = await Bun.build({ entrypoints: ["./src/main.ts"], plugins: [plugin], target: "bun" });',
      '  assert.equal(result.success, true, result.logs.join("\\n"));',
      '  assert.match(await result.outputs[0].text(), /"PLUGIN"/);',
      "}",
    ].join("\n"),
    "runtime.mjs": 'import "./src/main.ts";',
  });
  const run = promisify(execFile);
  const binary = process.env.TTSC_BUN_BINARY ?? "bun";
  const options = {
    cwd: root,
    env: process.env,
    timeout: 120_000,
    windowsHide: true,
  };
  await run(binary, ["build.mjs"], options);
  assert.equal(
    fs.statSync(log).size,
    2,
    "each completed Bun build releases its generation",
  );
  const result = await run(
    binary,
    ["--preload", path.join(library, "bun-register.mjs"), "runtime.mjs"],
    options,
  );
  assert.equal(result.stdout.trim(), "PLUGIN");
  assert.equal(
    fs.statSync(log).size,
    3,
    "runtime preload owns a new immutable load session",
  );
}
