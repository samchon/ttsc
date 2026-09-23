import {
  TestProject,
  TestUnpluginProject,
  TestUnpluginRuntime,
} from "@ttsc/testing";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

/**
 * Verifies a pooled session started again adopts the compile the last one
 * published, and refuses it once an input it depends on changed while nothing
 * ran (samchon/ttsc#1483).
 *
 * Turbopack runs the loader for every module after a dev-server restart, in
 * fresh workers with nothing in memory, and the store they shared died with the
 * process that opened it: each restart compiled every project once, while
 * webpack, Rspack, and Farm restored the same project without compiling. The
 * store now outlives the process, and a fresh worker adopts from it after the
 * same proof any adopter makes against its own disk.
 *
 * 1. Open a session in a process of its own, transform the entry module there, and
 *    exit: the project compiles once and the compile is published.
 * 2. Do it again in a new process, and assert it serves the same output without
 *    compiling.
 * 3. Edit a file outside the project that a plugin reads, while nothing runs; do
 *    it again, and assert it refuses the publication and compiles the current
 *    content.
 */
export async function test_transformttsc_pooled_workers_adopt_a_compile_from_before_a_restart(): Promise<void> {
  const external = path.join(
    TestProject.tmpdir("ttsc-unplugin-restart-external-"),
    "helper.ts",
  );
  fs.writeFileSync(external, "first\n", "utf8");
  const runLog = path.join(
    TestProject.tmpdir("ttsc-unplugin-restart-log-"),
    "compiles.bin",
  );
  const root = TestUnpluginProject.createProject({ plugins: [] });
  const relative = path.relative(root, external);
  const tsconfig = path.join(root, "tsconfig.json");
  const config = JSON.parse(fs.readFileSync(tsconfig, "utf8"));
  config.compilerOptions.plugins = [
    {
      transform: "./plugin.cjs",
      name: "reader",
      operation: "read-configured-helper",
      path: relative,
    },
    {
      transform: "./plugin.cjs",
      name: "reporter",
      operation: "emit-dependencies",
      dependencies: [relative.split(path.sep).join("/")],
    },
    {
      transform: "./plugin.cjs",
      name: "runs",
      operation: "count-runs",
      runLog,
    },
  ];
  fs.writeFileSync(tsconfig, JSON.stringify(config, null, 2), "utf8");
  const compiles = () => (fs.existsSync(runLog) ? fs.statSync(runLog).size : 0);
  const main = TestUnpluginProject.mainFile(root);
  // A private temporary directory, so the per-user store is this test's own.
  const temporary = TestProject.tmpdir("ttsc-unplugin-restart-tmp-");

  /** One dev-server session: open the store, transform the module, exit. */
  const session = (): string => {
    const env: NodeJS.ProcessEnv = {
      ...process.env,
      TEMP: temporary,
      TMP: temporary,
      TMPDIR: temporary,
    };
    delete env.TTSC_UNPLUGIN_TRANSFORM_SESSION;
    const run = spawnSync(
      process.execPath,
      [
        "--input-type=module",
        "-e",
        [
          `const api = await import(${JSON.stringify(TestUnpluginRuntime.libUrl("api"))});`,
          'const fs = await import("node:fs");',
          "const [file] = JSON.parse(process.argv[1]);",
          "api.openTtscTransformSession();",
          "const cache = api.createTtscTransformCache();",
          "api.shareTtscTransformCache(cache, api.readTtscTransformSession());",
          'const result = await api.transformTtsc(file, fs.readFileSync(file, "utf8"), api.resolveOptions(), undefined, cache);',
          'process.stdout.write(result?.code ?? "");',
        ].join("\n"),
        JSON.stringify([main]),
      ],
      { encoding: "utf8", env, windowsHide: true },
    );
    assert.equal(run.status, 0, run.stderr);
    return run.stdout;
  };

  // 1. The first session compiles and publishes.
  assert.match(session(), /PLUGIN:FIRST/);
  assert.equal(compiles(), 1);

  // 2. A restart adopts it.
  assert.match(session(), /PLUGIN:FIRST/);
  assert.equal(compiles(), 1, "a restart over an unchanged project");

  // 3. An input edited while nothing ran refutes it.
  fs.writeFileSync(external, "second\n", "utf8");
  assert.match(session(), /PLUGIN:SECOND/);
  assert.equal(compiles(), 2, "the current content, compiled");
}
