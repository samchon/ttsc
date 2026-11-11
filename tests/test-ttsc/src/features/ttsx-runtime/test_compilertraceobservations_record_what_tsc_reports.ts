import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import { CompilerTraceObservations } from "../../../../../packages/ttsc/src/compiler/internal/build/CompilerTraceObservations";
import { RuntimeInputContents } from "../../../../../packages/ttsc/src/compiler/internal/build/RuntimeInputContents";
import { RuntimeInputProof } from "../../../../../packages/ttsc/src/compiler/internal/build/RuntimeInputProof";
import { resolveTsgo } from "../../../../../packages/ttsc/src/compiler/internal/resolveTsgo";
import { TestProject } from "../../../../utils/src/TestProject";

/**
 * Verifies the questions the user's own tsc reports about a project are
 * recorded, and that replaying them notices every change that would alter the
 * compile, without running tsc again.
 *
 * A project without plugins is compiled by the installed tsc, which keeps no
 * record of its reads. Asking it for its file list on every warm run defeated
 * the cache (samchon/ttsc#1852); its file list and resolution trace, taken once
 * when the project is built, have to stand for that question instead.
 *
 * 1. Run the workspace tsc with `--listFilesOnly --traceResolution` on a project
 *    whose import resolves past a missing candidate and into a package.
 * 2. Record the observations and replay them unchanged.
 * 3. Make one change of each kind tsc's answer depends on and replay again.
 *
 * @evidence contracts/testing.md#behavioral-verification The real installed compiler produces the trace, the production recorder turns it into observations, and the production replay judges real filesystem changes; the returned path is the verdict.
 * @evidence contracts/testing.md#independent-expectations The authored tree fixes what tsc must have asked: the extensionless import probes helper.ts before selecting helper.tsx, the package import finds dep's package.json, and include "src" lists src. Each change names the path whose answer it alters.
 * @evidence contracts/testing.md#distinguishing-cases An unchanged tree, an edited source, a created higher-priority candidate, a new file in the included directory, an edited package manifest and an edited config separate content, resolution, membership, package and configuration answers.
 * @evidence contracts/testing.md#execution-ownership This source unit owns its temporary project below the checkout's ignored `.cache` and runs the workspace's TypeScript-Go compiler once; no ttsc host, plugin or installed consumer runs.
 */
export function test_compilertraceobservations_record_what_tsc_reports(): void {
  const root = TestProject.physicalPath(
    TestProject.tmpdir(
      "ttsc-trace-observations-",
      path.join(TestProject.WORKSPACE_ROOT, ".cache"),
    ),
  );
  const write = (name: string, text: string): string => {
    const file = path.join(root, name);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, text);
    return file;
  };
  const config = write(
    "tsconfig.json",
    JSON.stringify({
      compilerOptions: { module: "commonjs", target: "es2022", types: [] },
      include: ["src"],
    }),
  );
  const main = write(
    "src/main.ts",
    'import { h } from "./helper"; import { d } from "dep"; export const v = h + d;\n',
  );
  write("src/helper.tsx", "export const h = 1;\n");
  const manifest = write(
    "node_modules/dep/package.json",
    '{"name":"dep","types":"index.d.ts"}',
  );
  write("node_modules/dep/index.d.ts", "export declare const d: number;\n");

  const tsc = resolveTsgo({ cwd: TestProject.WORKSPACE_ROOT }).binary;
  const result = spawnSync(
    tsc,
    ["-p", config, "--listFilesOnly", "true", "--traceResolution", "true"],
    { cwd: root, encoding: "utf8" },
  );
  assert.equal(result.status, 0, result.stdout + result.stderr);
  const session = () =>
    RuntimeInputContents.open(config, undefined, RuntimeInputProof.textCodec);
  const recording = session();
  const observations = CompilerTraceObservations.observe({
    output: result.stdout,
    configPaths: [config],
    configInputs: [],
    contents: recording,
  });
  recording.close();
  assert.ok(observations !== undefined, "the trace has the expected shape");
  assert.equal(
    observations[path.join(root, "src", "helper.ts")]?.fileExists,
    false,
    "the missing candidate tsc probed is recorded absent",
  );
  assert.equal(observations[main]?.readFile?.ok, true);
  assert.equal(observations[manifest]?.readFile?.ok, true);
  assert.deepEqual(
    observations[path.join(root, "src")]?.accessibleEntries?.files,
    ["helper.tsx", "main.ts"],
  );

  const replay = (): string | undefined => {
    const contents = session();
    try {
      return RuntimeInputProof.replay(
        observations,
        path.join(root, "private-emit"),
        contents,
      );
    } finally {
      contents.close();
    }
  };
  const failures: Error[] = [];
  const expect = (
    label: string,
    moved: string | undefined,
    change: () => void,
    restore: () => void,
  ): void => {
    change();
    try {
      assert.equal(replay(), moved, label);
    } catch (cause) {
      failures.push(new Error(label, { cause }));
    } finally {
      restore();
    }
  };
  const mainText = fs.readFileSync(main, "utf8");
  const manifestText = fs.readFileSync(manifest, "utf8");
  const configText = fs.readFileSync(config, "utf8");
  const candidate = path.join(root, "src", "helper.ts");
  const added = path.join(root, "src", "added.ts");
  expect(
    "unchanged tree",
    undefined,
    () => {},
    () => {},
  );
  expect(
    "edited source",
    main,
    () => fs.writeFileSync(main, mainText + "export const w = 2;\n"),
    () => fs.writeFileSync(main, mainText),
  );
  expect(
    "higher-priority candidate created",
    // The probe tsc made is the first recorded answer that moved.
    candidate,
    () => fs.writeFileSync(candidate, "export const h = 2;\n"),
    () => fs.unlinkSync(candidate),
  );
  expect(
    "file added to the included directory",
    path.join(root, "src"),
    () => fs.writeFileSync(added, "export {};\n"),
    () => fs.unlinkSync(added),
  );
  expect(
    "package manifest edited",
    manifest,
    () => fs.writeFileSync(manifest, '{"name":"dep","types":"other.d.ts"}'),
    () => fs.writeFileSync(manifest, manifestText),
  );
  expect(
    "config edited",
    config,
    () => fs.writeFileSync(config, configText.replace("es2022", "es2023")),
    () => fs.writeFileSync(config, configText),
  );
  if (failures.length)
    throw new AggregateError(failures, "trace observation replay");
}
