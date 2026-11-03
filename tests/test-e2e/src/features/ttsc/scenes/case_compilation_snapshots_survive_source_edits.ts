import { TestProject, TestUnpluginRuntime } from "@ttsc/testing";
import type { TtscTransformHooks } from "@ttsc/unplugin/api";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { E2eProcessTrace } from "../../../../../utils/src/E2eProcessTrace";
import { isOrdinarilyClosedReadonlyLauncher } from "../../../../../utils/src/isOrdinarilyClosedReadonlyLauncher";

/**
 * Verifies installed runtime ownership and native bundler delivery survive
 * actual source edits across emission, then observe the next generation.
 *
 * The existing native contributor rewrites a real source sentinel and edits a
 * source from ApplyProgram, after the Program read it. A real selected-compiler
 * wrapper edits a runtime source after successful emission and before the
 * external ownership adapter resumes.
 *
 * 1. Deliver the raced native generation and its sibling in one build pass.
 * 2. Rebuild, introduce a type error and repair it through the same cache.
 * 3. Run two installed ttsx invocations across an external emission-time edit.
 *
 * @evidence contracts/testing.md#behavioral-verification Actual native Program output retains BEFORE with one compile despite an ApplyProgram disk edit; a later pass returns AFTER, errors remain visible and repair succeeds. Installed ttsx executes BEFORE after its external compiler edits disk, then AFTER on the next invocation.
 * @evidence contracts/testing.md#independent-expectations Literal BEFORE/AFTER/REPAIRED source and run-log counts distinguish captured output from recompilation or stale future reuse; the authored incompatible assignment must report an error.
 * @evidence contracts/testing.md#distinguishing-cases Current-pass sibling reuse, next-pass invalidation, real diagnostics and recovery contrast delivery authority with cache freshness. The external wrapper delegates every command to the selected real compiler and changes only the post-emission source.
 * @evidence contracts/testing.md#execution-ownership The runtime batch calls this scenario explicitly; it exercises installed ttsx, built unplugin API and the shared native contributor rather than portable policy alone.
 * @evidence contracts/e2e.md#necessary-boundary Driver snapshot transport, wire decoding, adapter admission, host pass handoff and runtime ownership must agree across actual native commands; direct policy units cannot establish that connection.
 * @evidence contracts/e2e.md#shared-execution The scenario borrows the batch installation, existing single-contributor source-pipeline profile and object cache, with the direct API's cache selector scoped and restored around its requests. Only the source transitions under test cause additional compiles; no contributor profile or consumer installation is added.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity All edited files and receipts belong to the batch's otherwise unused tools/compilation-snapshot island; cache observers are reset in finally, synchronous runtime actors are checked for ordinary closure and the batch owns final directory cleanup.
 * @evidence contracts/e2e.md#preserved-coverage This adds snapshot boundaries without moving or weakening existing runtime, source-map, cache or bundler cases.
 */
export async function case_compilation_snapshots_survive_source_edits(inputs: {
  root: string;
  source: string;
  cacheDir: string;
  installedTtsx: string;
}): Promise<void> {
  const root = path.join(inputs.root, "tools/compilation-snapshot");
  fs.mkdirSync(root, { recursive: true });
  const write = (name: string, text: string) =>
    fs.writeFileSync(path.join(root, name), text);
  const source = path.join(root, "entry.ts");
  const log = path.join(root, "runs.bin");
  write("package.json", '{"private":true,"type":"commonjs"}');
  write("runs.bin", "");
  write(
    "descriptor.cjs",
    'module.exports = context => { if (process.env.TTSC_COMPILATION_SNAPSHOT !== undefined) throw new Error("private compiler snapshot leaked into descriptor"); return { source: context.plugin.fixtureSource }; };\n',
  );
  const pipeline = 'export const transformed = "__TTSC_NATIVE_PIPELINE__";\n';
  const beforeSource = 'export const value: string = "BEFORE";\n' + pipeline;
  const afterSource = 'export const value: string = "AFTER";\n' + pipeline;
  write("entry.ts", beforeSource);
  write(
    "sibling.ts",
    'import { value } from "./entry"; export const sibling = "SIBLING:" + value;\n' +
      pipeline,
  );
  write(
    "tsconfig.json",
    JSON.stringify({
      compilerOptions: {
        target: "es2020",
        module: "commonjs",
        strict: true,
        types: [],
        plugins: [
          {
            transform: "./descriptor.cjs",
            fixtureSource: inputs.source,
            operation: "source-pipeline",
            prefix: "snapshot:",
            suffix: ":retained",
            runLog: log,
            raceAttempt: 0,
            raceFile: source,
            raceContent: afterSource,
          },
        ],
      },
      files: ["entry.ts", "sibling.ts"],
    }),
  );
  const api = await TestUnpluginRuntime.loadUnpluginApi();
  const cache = api.createTtscTransformCache();
  const options = api.resolveOptions({
    project: path.join(root, "tsconfig.json"),
  });
  let sourceWatchHash: string | undefined;
  let volatileDeliveries = 0;
  const hooks: TtscTransformHooks = {
    markVolatile: () => {
      volatileDeliveries++;
    },
    addWatchFiles: (watched) => {
      for (const input of watched) {
        if (path.resolve(input.file) !== source) continue;
        const state = input.evidence?.state;
        if (state?.codec === "predicates" && state.observation.readFile?.ok)
          sourceWatchHash = state.observation.readFile.hash;
      }
    },
  };
  const deliver = (file = source) =>
    api.transformTtsc(
      file,
      fs.readFileSync(file, "utf8"),
      options,
      undefined,
      cache,
      hooks,
    );
  const savedCache = process.env.TTSC_CACHE_DIR;
  process.env.TTSC_CACHE_DIR = inputs.cacheDir;
  try {
    api.beginTtscTransformBuild(cache);
    const first = await deliver();
    assert.ok(first);
    assert.match(first.code, /BEFORE/);
    assert.match(first.code, /SNAPSHOT:PLUGIN:retained/);
    assert.match(fs.readFileSync(source, "utf8"), /AFTER/);
    assert.equal(
      fs.readFileSync(log).length,
      1,
      "the edit must not retry the captured compilation",
    );
    assert.equal(
      volatileDeliveries,
      1,
      "raced output cannot enter a persistent host cache",
    );
    const sibling = await deliver(path.join(root, "sibling.ts"));
    assert.ok(sibling);
    assert.match(sibling.code, /SIBLING/);
    assert.equal(
      fs.readFileSync(log).length,
      1,
      "siblings share the original pass",
    );
    assert.equal(
      sourceWatchHash,
      crypto.createHash("sha256").update(beforeSource).digest("hex"),
      "watch handoff must preserve the compiler's input, not the edited disk",
    );
    api.beginTtscTransformBuild(cache);
    assert.match((await deliver())!.code, /AFTER/);
    write("entry.ts", "export const value: string = 123;\n" + pipeline);
    api.beginTtscTransformBuild(cache);
    await assert.rejects(deliver(), /not assignable|2322/);
    write("entry.ts", 'export const value: string = "REPAIRED";\n' + pipeline);
    api.beginTtscTransformBuild(cache);
    assert.match((await deliver())!.code, /REPAIRED/);
  } finally {
    try {
      api.resetTtscTransformCache(cache);
    } finally {
      if (savedCache === undefined) delete process.env.TTSC_CACHE_DIR;
      else process.env.TTSC_CACHE_DIR = savedCache;
    }
  }

  const runtime = path.join(root, "runtime.ts");
  const after = 'console.log("AFTER");\n';
  write("runtime.ts", 'console.log("BEFORE");\n');
  write(
    "runtime.tsconfig.json",
    JSON.stringify({
      compilerOptions: { target: "es2020", module: "commonjs", types: [] },
      files: ["runtime.ts"],
    }),
  );
  write(
    "compiler.cjs",
    [
      "const fs = require('node:fs'); const { spawnSync } = require('node:child_process');",
      `const args = process.argv.slice(2); const result = spawnSync(${JSON.stringify(TestProject.TSGO_BINARY)}, args, {stdio:'inherit'});`,
      "const listed = args.lastIndexOf('--listEmittedFiles');",
      `if (result.status === 0 && listed >= 0 && args[listed + 1] === 'true' && !args.includes('--listFilesOnly')) fs.writeFileSync(${JSON.stringify(runtime)}, ${JSON.stringify(after)});`,
      "process.exit(result.status ?? 1);",
    ].join("\n"),
  );
  for (const expected of ["BEFORE", "AFTER"]) {
    const actor = E2eProcessTrace.spawnSync(
      process.execPath,
      [
        inputs.installedTtsx,
        "-P",
        path.join(root, "runtime.tsconfig.json"),
        runtime,
      ],
      {
        cwd: root,
        encoding: "utf8",
        windowsHide: true,
        env: {
          ...process.env,
          TTSC_CACHE_DIR: inputs.cacheDir,
          TTSC_TSGO_BINARY: path.join(root, "compiler.cjs"),
        },
      },
    );
    assert.ok(
      isOrdinarilyClosedReadonlyLauncher(actor),
      "runtime actor must close normally",
    );
    assert.equal(actor.status, 0, actor.stdout + actor.stderr);
    assert.equal(actor.stdout.trim(), expected);
  }
}
