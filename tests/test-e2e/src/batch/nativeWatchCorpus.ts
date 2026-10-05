import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { WatchSession } from "../internal/ttsc/internal/watch";
import { BatchWorkspace } from "./BatchWorkspace";

/**
 * Preserve native JSON membership, warm inputs, duplicate delivery and
 * dead-owner fallback in one public watch session.
 *
 * @evidence contracts/testing.md#behavioral-verification Actual resident telemetry distinguishes five JSON/Markdown transitions, two duplicate plugin deliveries and forwarded TS7006 after genuine native resident death.
 * @evidence contracts/testing.md#independent-expectations Literal load/update tables distinguish root membership from bytes; source has an untyped parameter and forwarded noImplicitAny requires TS7006 even under strict:false.
 * @evidence contracts/testing.md#distinguishing-cases Missing/present/deleted JSON, JSON versus Markdown content, single versus duplicate plugins and healthy versus actually dead resident remain separate observations.
 * @evidence contracts/testing.md#execution-ownership The selected esbuild batch calls this consolidated body once. One upfront nested project owns a real CLI watch and successive native residents; config transitions and fallback are real extra native work, not one Program or zero cost.
 * @evidence contracts/e2e.md#necessary-boundary OS events, Go project-input registration, native resident protocol and fallback argv must agree; source-unit counters cannot prove their connection.
 * @evidence contracts/e2e.md#shared-execution All transitions share one actual watcher and package producer. Duplicate and single config epochs necessarily replace native residents; deliberate death acquires a real fallback. No per-case fixture preparation or plugin-cache deletion occurs.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The upfront nested source/config/Markdown are restored only after nonce-bound actual watcher closure. Failed closure retains the shared root and refuses later mutations; body and shutdown errors are both retained.
 * @evidence contracts/e2e.md#preserved-coverage Restores original valid five-step telemetry, duplicate buffer reuse and dead-host compiler-flag meanings. Counters are native telemetry, not total Program construction proof; Actual edits to the copied selected lint module sibling Go rule and its go.mod require a replacement resident and the edited diagnostic; an owned node_modules Go-byte copy must remain quiet. Full compiler-list/refs/output/case OS topology remains separate unproved coverage. These extra epochs add two actual resident lifetimes and native rebuild work.
 */
export async function nativeWatchCorpus(
  workspace: BatchWorkspace.Workspace,
): Promise<void> {
  const root = path.join(workspace.root, "tools/native-watch");
  const source = path.join(root, "src/main.ts");
  const config = path.join(root, "tsconfig.json");
  const markdown = path.join(root, "docs/spec.md");
  const json = path.join(root, "api/openapi.json");
  const producer = path.join(workspace.root, "tools/mutable-lint-producer");
  const rule = path.join(producer, "linthost/rules_var.go");
  const module = path.join(producer, "go.mod");
  const ignoredPackage = path.join(producer, "node_modules/e2e-watch-pruned");
  assert.equal(fs.existsSync(ignoredPackage), false);
  const originals = new Map(
    [source, config, markdown, rule, module].map((file) => [file, fs.readFileSync(file)]),
  );
  const lintConfig = path.join(root, "lint.config.cjs");
  assert.equal(fs.existsSync(lintConfig), false);
  fs.writeFileSync(
    lintConfig,
    `module.exports={plugins:{topology:{source:${JSON.stringify(path.join(TestProject.WORKSPACE_ROOT, "packages/lint/test/watch-project-input"))}}},rules:{"topology/project-input":"error","no-var":"warning"}};\n`,
  );
  const failures: unknown[] = [];
  let joined = false;
  const session = new WatchSession(root, {
    args: ["--noEmit", "--diagnostics", "--noImplicitAny"],
    env: { TTSC_CACHE_DIR: workspace.cache, TTSC_WATCH_DEBUG_INPUTS: "1" },
    ownershipRoot: workspace.root,
  });
  const samples = (text: string) =>
    [
      ...text.matchAll(
        /@ttsc\/lint resident check: pid=(\d+) programLoads=(\d+) programUpdates=(\d+) reused=(true|false)/g,
      ),
    ].map((match) => ({
      pid: Number(match[1]),
      programLoads: Number(match[2]),
      programUpdates: Number(match[3]),
      reused: match[4] === "true",
    }));
  const sample = (
    index: number,
    pid: number,
    loads: number,
    updates: number,
    reused: boolean,
  ) =>
    assert.deepEqual(
      samples(session.transcript())[index],
      { pid, programLoads: loads, programUpdates: updates, reused },
      session.transcript(),
    );
  const cycle = async (count: number) => {
    await session.waitForBuilds(count);
    await session.waitForSettled(300);
  };
  try {
    await session.waitForBuilds(1, 300_000);
    await session.waitForSettled(300);
    assert.equal(samples(session.transcript()).length, 1, session.transcript());
    const pid = samples(session.transcript())[0]!.pid;
    assert.ok(Number.isSafeInteger(pid) && pid > 0 && pid !== process.pid);
    sample(0, pid, 1, 0, false);
    fs.mkdirSync(path.dirname(json), { recursive: true });
    fs.writeFileSync(json, '{"name":"created"}\n');
    await cycle(2);
    assert.equal(samples(session.transcript()).length, 2);
    sample(1, pid, 2, 0, false);
    fs.writeFileSync(json, '{"name":"edited"}\n');
    await cycle(3);
    assert.equal(samples(session.transcript()).length, 3);
    sample(2, pid, 2, 1, true);
    fs.writeFileSync(markdown, "# Revised contract\n");
    await cycle(4);
    assert.equal(samples(session.transcript()).length, 4);
    sample(3, pid, 2, 1, true);
    fs.unlinkSync(json);
    await cycle(5);
    assert.equal(samples(session.transcript()).length, 5);
    sample(4, pid, 3, 1, false);
    const project = JSON.parse(originals.get(config)!.toString());
    project.compilerOptions.plugins = [
      { transform: "@ttsc/lint" },
      { transform: "@ttsc/lint" },
    ];
    fs.writeFileSync(
      source,
      "var legacy = 1;\nJSON.stringify(legacy);\nexport function echo(value) { return value; }\n",
    );
    await cycle(6);
    const duplicateBoundary = session.transcript().length;
    fs.writeFileSync(config, JSON.stringify(project));
    await cycle(7);
    const duplicate = samples(session.transcript().slice(duplicateBoundary));
    assert.equal(duplicate.length, 2, session.transcript());
    assert.notEqual(duplicate[0]!.pid, pid);
    assert.deepEqual(
      duplicate.map(({ pid: _, ...value }) => value),
      [
        { programLoads: 1, programUpdates: 0, reused: false },
        { programLoads: 1, programUpdates: 0, reused: true },
      ],
    );
    assert.equal(duplicate[1]!.pid, duplicate[0]!.pid);
    const updateBoundary = session.transcript().length;
    fs.appendFileSync(source, "// refreshed duplicate delivery\n");
    await cycle(8);
    assert.deepEqual(samples(session.transcript().slice(updateBoundary)), [
      {
        pid: duplicate[0]!.pid,
        programLoads: 1,
        programUpdates: 1,
        reused: true,
      },
      {
        pid: duplicate[0]!.pid,
        programLoads: 1,
        programUpdates: 2,
        reused: true,
      },
    ]);
    assert.doesNotMatch(session.transcript(), /invalid request/i);
    project.compilerOptions.plugins = [{ transform: "@ttsc/lint" }];
    const singleBoundary = session.transcript().length;
    fs.writeFileSync(config, JSON.stringify(project));
    await cycle(9);
    const single = samples(session.transcript().slice(singleBoundary));
    assert.equal(single.length, 1, session.transcript());
    assert.notEqual(single[0]!.pid, duplicate[0]!.pid);
    const ruleText = originals.get(rule)!.toString();
    const editedRule = ruleText.replace('"Unexpected var, use let or const instead."', '"Unexpected var, from the watched sibling Go source."');
    assert.notEqual(editedRule, ruleText);
    const sourceBoundary = session.transcript().length;
    fs.writeFileSync(rule, editedRule);
    await cycle(10);
    assert.match(session.transcript().slice(sourceBoundary), /Unexpected var, from the watched sibling Go source\./);
    const sourceEpoch = samples(session.transcript().slice(sourceBoundary));
    assert.equal(sourceEpoch.length, 1);
    assert.notEqual(sourceEpoch[0]!.pid, single[0]!.pid);
    const moduleBoundary = session.transcript().length;
    fs.appendFileSync(module, "\n// watched owning module metadata\n");
    await cycle(11);
    assert.match(session.transcript().slice(moduleBoundary), /Unexpected var, from the watched sibling Go source\./);
    const moduleEpoch = samples(session.transcript().slice(moduleBoundary));
    assert.equal(moduleEpoch.length, 1);
    assert.notEqual(moduleEpoch[0]!.pid, sourceEpoch[0]!.pid);
    const ignoredBoundary = session.transcript().length;
    fs.mkdirSync(ignoredPackage);
    fs.copyFileSync(rule, path.join(ignoredPackage, "ignored.go"));
    await session.waitForQuiet(3_000);
    assert.deepEqual(samples(session.transcript().slice(ignoredBoundary)), []);
    const healthy = session.transcript();
    const healthyCount = (healthy.match(/TS7006/g) ?? []).length;
    assert.ok(healthyCount >= 1, healthy);
    assert.ok(
      Number.isSafeInteger(moduleEpoch[0]!.pid) &&
        moduleEpoch[0]!.pid > 0 &&
        moduleEpoch[0]!.pid !== process.pid,
    );
    process.kill(moduleEpoch[0]!.pid);
    fs.appendFileSync(source, "// changed after actual resident death\n");
    await cycle(12);
    assert.equal(
      (session.transcript().match(/TS7006/g) ?? []).length,
      healthyCount + 1,
      session.transcript(),
    );
  } catch (error) {
    failures.push(error);
  } finally {
    try {
      await session.close();
      joined = true;
    } catch (error) {
      BatchWorkspace.retain(
        "native watch did not acknowledge actual native-owner closure",
      );
      failures.push(error);
    }
    if (joined)
      for (const restore of [
        ...[...originals].map(
          ([file, bytes]) =>
            () =>
              fs.writeFileSync(file, bytes),
        ),
        () => {
          if (fs.existsSync(json)) fs.unlinkSync(json);
        },
        () => fs.unlinkSync(lintConfig),
        () => { if (fs.existsSync(ignoredPackage)) fs.rmSync(ignoredPackage, { recursive: true }); },
      ])
        try {
          restore();
        } catch (error) {
          BatchWorkspace.retain(
            "native watch authored input restoration failed after closure",
          );
          failures.push(error);
        }
  }
  if (failures.length)
    throw new AggregateError(failures, "native shared watch and shutdown");
}
