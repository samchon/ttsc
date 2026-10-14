import assert from "node:assert/strict";
import childProcess from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { SidecarEnvironment } from "../../../../../packages/ttsc/src/compiler/internal/sharedHost/SidecarEnvironment";
import { PluginDescriptorEvaluationCache } from "../../../../../packages/ttsc/src/plugin/internal/load/PluginDescriptorEvaluationCache";

/**
 * Verifies descriptor reuse distinguishes the evaluator's working directory.
 *
 * A factory may derive its source from process.cwd() while declaring no
 * external file reads. Its consumer context and absolute cache root can stay
 * identical when the source root changes.
 *
 * 1. Load and evaluate an owned CommonJS factory in Node children with explicit
 *    cwd.
 * 2. Feed the shared recorder's real observations through the source cache API.
 * 3. Distinguish root changes from warm reuse by source results and factory calls.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls authored PluginDescriptorEvaluationCache.locate/read/write directly and evaluates a real owned factory through Node createRequire on misses. Exact root-derived sources and reported factory invocation totals catch stale answers across source roots and needless reevaluation within one root.
 * @evidence contracts/testing.md#independent-expectations Independently authored source roots determine the expected native paths and the cold/warm sequence determines invocation totals 1,1,2,2,2. SHA-256 of the authored descriptor bytes and native realpath check the child's recorded input proof; expected source values and invocation counts are not derived from the cache key.
 * @evidence contracts/testing.md#distinguishing-cases Keeps descriptor, tsconfig, consumer context, effective environment, runtime and absolute storage root identical across two source roots; covers each cold load, each same-root warm load and returning to the first root. Empty hostInputHashes is a valid no-external-read declaration. Existing cache-policy units own malformed, conflicting, missing and changed-input proofs; this unit does not certify arbitrary module graphs or production isolated-loader startup.
 * @evidence contracts/testing.md#execution-ownership One discoverable source unit invokes cache owners in its runner process and starts only owned synchronous Node factory actors with cwd options. The known fixture graph contains one CommonJS module and node:path; the shared recorder records its module and package scope before loading and revalidates after evaluation. No consumer installation, native artifact, compiler or product host runs, and no global cwd/fs/env is replaced. Confirmed child settlement precedes cleanup; uncertain settlement retains scratch, and body and cleanup errors are aggregated.
 */
export function test_descriptor_evaluation_cache_distinguishes_evaluator_cwd(): void {
  const root = fs.realpathSync.native(
    fs.mkdtempSync(path.join(os.tmpdir(), "ttsc-descriptor-cwd-")),
  );
  const failures: unknown[] = [];
  const check = (name: string, operation: () => void): void => {
    try {
      operation();
    } catch (cause) {
      failures.push(new Error(name, { cause }));
    }
  };
  const consumer = path.join(root, "consumer");
  const firstRoot = path.join(root, "source-R1");
  const secondRoot = path.join(root, "source-R2");
  const cacheDir = path.join(root, "cache");
  const request = path.join(consumer, "descriptor.cjs");
  const tsconfig = path.join(consumer, "tsconfig.json");
  const manifest = path.join(consumer, "package.json");
  const bytes = [
    'const path = require("node:path");',
    "let evaluations = 0;",
    "exports.createTtscPlugin = () => {",
    "  evaluations++;",
    '  return { name: "cwd-proof", source: path.resolve(process.cwd(), "native"), hostInputHashes: {} };',
    "};",
    "exports.evaluations = () => evaluations;",
    "",
  ].join("\n");
  const actor = [
    'const { createRequire } = require("node:module");',
    "const [recorderPath, request, serializedContext] = process.argv.slice(1);",
    "const { createResolutionInputRecorder } = require(recorderPath);",
    'const recorder = createResolutionInputRecorder({ extensions: [".cjs"] });',
    "recorder.recordFile(request);",
    "const mod = createRequire(request)(request);",
    "const descriptor = mod.createTtscPlugin(JSON.parse(serializedContext));",
    "const observation = recorder.finish();",
    "process.stdout.write(JSON.stringify({",
    "  cwd: process.cwd(),",
    "  factoryCalls: mod.evaluations(),",
    "  evaluation: {",
    "    descriptor,",
    "    hostInputHashes: observation.hashes,",
    "    hostInputRealpaths: observation.realpaths,",
    "    inputs: observation.inputs,",
    "    observationsComplete: observation.complete,",
    "  },",
    "}));",
  ].join("\n");
  const recorder = fileURLToPath(
    new URL(
      "../../../../../packages/ttsc/driver/resolutioninputs/recorder.cjs",
      import.meta.url,
    ),
  );
  const env = SidecarEnvironment.merge(process.env, {
    NODE_OPTIONS: undefined,
  });
  const context = {
    binary: "",
    cwd: root,
    dirname: consumer,
    filename: request,
    plugin: { transform: request },
    pluginConfigDir: consumer,
    projectRoot: consumer,
    tsconfig,
  };
  let allChildrenSettled = true;
  let factoryCalls = 0;
  const actors: string[] = [];
  const entries = new Map<string, string>();
  const load = (
    name: string,
    sourceRoot: string,
  ): PluginDescriptorEvaluationCache.IEvaluation => {
    // A variable permits this future identity input on the old locator's type,
    // so the pre-repair failure observes runtime behavior rather than typing.
    const authority = {
      cacheDir,
      context,
      cwd: sourceRoot,
      env,
      projectRoot: sourceRoot,
      request,
      runtime: process.execPath,
      version: "descriptor-cwd-source-unit",
    };
    const file = PluginDescriptorEvaluationCache.locate(authority);
    assert.ok(file, "actual Node executable must identify a cache entry");
    entries.set(sourceRoot, file);
    const cached = PluginDescriptorEvaluationCache.read(file);
    if (cached !== null) return cached;

    const previousSettlement = allChildrenSettled;
    allChildrenSettled = false;
    const result = childProcess.spawnSync(
      process.execPath,
      ["-e", actor, recorder, request, JSON.stringify(context)],
      { cwd: sourceRoot, encoding: "utf8", env, windowsHide: true },
    );
    allChildrenSettled =
      previousSettlement &&
      result.error === undefined &&
      result.signal === null &&
      result.status !== null;
    const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
    assert.equal(result.error, undefined, output);
    assert.equal(result.signal, null, output);
    assert.equal(result.status, 0, output);
    const report = JSON.parse(result.stdout) as {
      cwd: string;
      factoryCalls: number;
      evaluation: PluginDescriptorEvaluationCache.IEvaluation;
    };
    assert.equal(report.cwd, sourceRoot);
    assert.equal(report.factoryCalls, 1);
    factoryCalls += report.factoryCalls;
    actors.push(name);
    const evaluation = report.evaluation;
    assert.equal(evaluation.observationsComplete, true);
    assert.ok(evaluation.inputs.includes(request));
    assert.ok(evaluation.inputs.includes(manifest));
    assert.equal(
      evaluation.hostInputHashes[request],
      crypto.createHash("sha256").update(bytes).digest("hex"),
    );
    assert.equal(
      evaluation.hostInputRealpaths[request],
      fs.realpathSync.native(request),
    );
    PluginDescriptorEvaluationCache.write(file, evaluation);
    return evaluation;
  };
  try {
    for (const directory of [consumer, firstRoot, secondRoot, cacheDir])
      fs.mkdirSync(directory);
    fs.writeFileSync(manifest, '{"type":"commonjs"}\n');
    fs.writeFileSync(tsconfig, "{}\n");
    fs.writeFileSync(request, bytes);
    const rows = [
      ["R1/cold", firstRoot, 1],
      ["R1/warm", firstRoot, 1],
      ["R2/cold", secondRoot, 2],
      ["R2/warm", secondRoot, 2],
      ["R1/return", firstRoot, 2],
    ] as const;
    for (const [name, sourceRoot, expectedCalls] of rows) {
      let evaluation: PluginDescriptorEvaluationCache.IEvaluation | undefined;
      check(`${name}/load`, () => {
        evaluation = load(name, sourceRoot);
      });
      if (evaluation !== undefined) {
        const descriptor = evaluation.descriptor as {
          source: unknown;
          hostInputHashes: unknown;
        };
        check(`${name}/source`, () =>
          assert.equal(descriptor.source, path.join(sourceRoot, "native")),
        );
        check(`${name}/declaration`, () =>
          assert.deepEqual(descriptor.hostInputHashes, {}),
        );
      }
      check(`${name}/factory calls`, () =>
        assert.equal(factoryCalls, expectedCalls),
      );
    }
    check("only cold roots evaluate", () =>
      assert.deepEqual(actors, ["R1/cold", "R2/cold"]),
    );
    check("different cwd entries share the selected storage root", () => {
      assert.notEqual(entries.get(firstRoot), entries.get(secondRoot));
      for (const file of entries.values())
        assert.equal(path.dirname(file), path.join(cacheDir, "descriptors"));
    });
  } catch (cause) {
    failures.push(cause);
  } finally {
    if (allChildrenSettled) {
      try {
        fs.rmSync(root, { recursive: true, force: true });
      } catch (cause) {
        failures.push(cause);
      }
    } else
      failures.push(
        new Error(
          `Unconfirmed factory actor settlement; retained scratch ${root}`,
        ),
      );
  }
  if (failures.length !== 0)
    throw new AggregateError(failures, "descriptor evaluator cwd identity");
}
