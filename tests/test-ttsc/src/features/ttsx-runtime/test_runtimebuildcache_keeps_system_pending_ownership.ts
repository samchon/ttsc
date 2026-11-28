import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { RuntimeBuildCache } from "../../../../../packages/ttsc/src/compiler/internal/build/RuntimeBuildCache";
import { systemRuntimeRunCanChange } from "../../../../../packages/ttsc/src/launcher/internal/runtime/systemRuntimeRunCanChange";

/**
 * Exercises project preservation and legitimate parking in a system runtime
 * cache.
 *
 * @evidence contracts/testing.md#behavioral-verification The native store reads real saved requests, parks and adopts the original run's output, and preserves foreign trees and an aliased pending parent.
 * @evidence contracts/testing.md#independent-expectations Authored marker and output bytes, original coordinates and an independent producer count distinguish an actual reuse from an uncached build.
 * @evidence contracts/testing.md#distinguishing-cases A project marker added after requesting a move, refused receipts, incomplete or ordinary inline publication, and uncommitted adoption leave stable output. A committed park and its replay retire only the same environment variant. The fixture also checks linked paths and a guarded hardlinked job rewrite.
 * @evidence contracts/testing.md#execution-ownership The unit uses an owned temporary tree and removes the junction before removing the tree. It starts no compiler or watcher.
 */
export function test_runtimebuildcache_keeps_system_pending_ownership(): void {
  const root = fs.realpathSync.native(
    fs.mkdtempSync(path.join(os.tmpdir(), "ttsx-pending-ownership-")),
  );
  const systemCache = path.join(root, "runtime");
  const run = path.join(systemCache, "project", "owned-run");
  const store = path.join(systemCache, "runtime-builds");
  const project = path.join(root, "consumer");
  const generation = (owner: string) =>
    path.join(
      owner,
      "deps",
      "a".repeat(16),
      "gen-" + crypto.randomBytes(16).toString("hex"),
    );
  const outsideOutput = generation(
    path.join(systemCache, "project", "different-run"),
  );
  const source = path.join(project, "main.ts");
  const canChange = (directory: string) =>
    systemRuntimeRunCanChange(directory, systemCache, [project]);
  const parks = path.join(run, "parks");
  let builds = 0;
  const build = (
    emitDir: string,
    beforeAdopt?: (emit: string) => string | undefined,
    options?: {
      variant?: string;
      mode?: "inline" | "defer";
    },
  ) => {
    fs.mkdirSync(emitDir, { recursive: true });
    return RuntimeBuildCache.run({
      directory: store,
      canChange,
      runDir: run,
      parkIn: options?.mode === undefined ? run : undefined,
      defer: options?.mode === "defer" ? () => undefined : undefined,
      emitDir,
      capture: () => undefined,
      admit: () => true,
      identity: () => "owned-build",
      replay: (_result, emit) => beforeAdopt?.(emit),
      environmentValue: () => options?.variant,
      recordParked: (result) => result,
      build: () => {
        ++builds;
        const output = path.join(emitDir, "main.js");
        fs.writeFileSync(output, "owned build output");
        return {
          status: 0,
          diagnostics: [],
          stdout: "",
          stderr: "",
          compilerObservations: {},
          environmentInputs:
            options?.variant === undefined
              ? undefined
              : { TTSC_TEST_VARIANT: options.variant },
          emittedSources: { [output]: [source] },
        };
      },
    });
  };
  try {
    fs.mkdirSync(project);
    fs.mkdirSync(outsideOutput, { recursive: true });
    fs.writeFileSync(path.join(outsideOutput, "keep.js"), "another run");
    const firstOutput = generation(run);
    assert.equal(build(firstOutput).status, 0);
    const [record] = fs.readdirSync(parks);
    assert.ok(record);
    const request = JSON.parse(
      fs.readFileSync(path.join(parks, record), "utf8"),
    );
    const pending = path.dirname(request.parked);
    const forgedParked = path.join(pending, `1-1-${crypto.randomUUID()}`);
    fs.writeFileSync(
      path.join(parks, "outside.json"),
      JSON.stringify({
        ...request,
        outputs: outsideOutput,
        parked: forgedParked,
        job: { ...request.job, emitDir: outsideOutput },
      }),
    );
    RuntimeBuildCache.parkRequested(run, store, canChange);
    assert.equal(fs.existsSync(firstOutput), false);
    assert.equal(fs.existsSync(forgedParked), false);
    assert.equal(
      fs.readFileSync(path.join(outsideOutput, "keep.js"), "utf8"),
      "another run",
    );

    const foreign = path.join(pending, "foreign-project");
    fs.mkdirSync(foreign);
    fs.writeFileSync(path.join(foreign, "go.work"), "go 1.24.0\n");
    const adopted = generation(run);
    assert.equal(build(adopted).status, 0);
    assert.equal(builds, 1);
    assert.equal(
      fs.readFileSync(path.join(adopted, "main.js"), "utf8"),
      "owned build output",
    );
    assert.equal(
      fs.readFileSync(path.join(foreign, "go.work"), "utf8"),
      "go 1.24.0\n",
    );
    const carry = fs
      .readdirSync(path.dirname(adopted))
      .find((name) => name.startsWith(path.basename(adopted) + ".parked-"));
    assert.ok(carry);
    const carriedJob = path.join(path.dirname(adopted), carry, "job.json");
    const outsideJob = path.join(root, "keep-job.json");
    const originalJob = fs.readFileSync(carriedJob);
    fs.linkSync(carriedJob, outsideJob);
    RuntimeBuildCache.parkRequested(run, store, canChange);
    assert.equal(fs.existsSync(adopted), false);
    assert.deepEqual(fs.readFileSync(outsideJob), originalJob);
    const [next] = fs
      .readdirSync(pending)
      .filter((name) => name !== "foreign-project");
    assert.ok(next);
    const stored = path.join(pending, next);
    assert.equal(
      JSON.parse(fs.readFileSync(path.join(stored, "job.json"), "utf8"))
        .recorded,
      true,
    );

    const heldParks = path.join(run, "held-parks");
    const outsideParks = path.join(root, "outside-parks");
    fs.mkdirSync(outsideParks);
    for (const phase of ["adoption", "fresh"]) {
      let linkedParks = false;
      try {
        const refused = generation(run);
        assert.equal(
          build(refused, () => {
            fs.renameSync(parks, heldParks);
            fs.symlinkSync(outsideParks, parks, "junction");
            linkedParks = true;
            return phase === "fresh" ? "input changed" : undefined;
          }).status,
          0,
        );
        assert.equal(linkedParks, true);
        assert.equal(builds, phase === "adoption" ? 2 : 3);
        assert.equal(
          fs.readFileSync(path.join(stored, "outputs", "main.js"), "utf8"),
          "owned build output",
        );
        assert.deepEqual(fs.readdirSync(outsideParks), []);
      } finally {
        if (linkedParks) {
          if (process.platform === "win32") fs.rmdirSync(parks);
          else fs.unlinkSync(parks);
        }
        if (fs.existsSync(heldParks)) fs.renameSync(heldParks, parks);
      }
    }

    const redirected = path.join(root, "redirected-pending");
    fs.renameSync(pending, redirected);
    const before = fs.readdirSync(redirected).sort();
    fs.symlinkSync(redirected, pending, "junction");
    try {
      const isolated = generation(run);
      assert.equal(build(isolated).status, 0);
      assert.equal(builds, 4);
      RuntimeBuildCache.parkRequested(run, store, canChange);
      assert.equal(
        fs.readFileSync(path.join(isolated, "main.js"), "utf8"),
        "owned build output",
      );
      assert.deepEqual(fs.readdirSync(redirected).sort(), before);
    } finally {
      if (process.platform === "win32") fs.rmdirSync(pending);
      else fs.unlinkSync(pending);
    }
    fs.renameSync(redirected, pending);

    const requestFor = (emitDir: string): RuntimeBuildCache.ParkRequest => {
      for (const name of fs.readdirSync(parks)) {
        const record = JSON.parse(
          fs.readFileSync(path.join(parks, name), "utf8"),
        );
        if (record.outputs === emitDir) return record;
      }
      throw new Error("Missing producer park request");
    };
    const inputChanged = () => "input changed";
    const markedOutput = generation(run);
    assert.equal(build(markedOutput, inputChanged).status, 0);
    const refused = requestFor(markedOutput);
    assert.ok(refused.replacement);
    const insertedMarker = path.join(markedOutput, "package.json");
    const projectBytes = '{"name":"inserted-project"}\n';
    fs.writeFileSync(insertedMarker, projectBytes);
    assert.equal(fs.existsSync(stored), true);
    RuntimeBuildCache.parkRequested(run, store, canChange);
    assert.equal(fs.existsSync(refused.parked), false);
    assert.equal(fs.existsSync(stored), true);
    assert.equal(fs.readFileSync(insertedMarker, "utf8"), projectBytes);

    const later = path.join(pending, `1-1-${crypto.randomUUID()}`);
    fs.mkdirSync(later);
    fs.copyFileSync(
      path.join(stored, "job.json"),
      path.join(later, "job.json"),
    );
    const newOutput = generation(run);
    assert.equal(build(newOutput, inputChanged).status, 0);
    const accepted = requestFor(newOutput);
    assert.ok(accepted.replacement);
    assert.equal(fs.existsSync(stored), true);
    assert.equal(
      accepted.replacement.prior.some(
        (candidate) => candidate.directory === later,
      ),
      false,
    );
    fs.mkdirSync(path.join(later, "outputs"));
    fs.writeFileSync(
      path.join(later, "outputs", "keep.js"),
      "concurrent output",
    );
    RuntimeBuildCache.parkRequested(run, store, canChange);
    assert.equal(fs.existsSync(stored), false);
    assert.equal(
      fs.readFileSync(path.join(accepted.parked, "outputs", "main.js"), "utf8"),
      "owned build output",
    );
    assert.equal(
      fs.readFileSync(path.join(later, "outputs", "keep.js"), "utf8"),
      "concurrent output",
    );

    const restartOutput = generation(run);
    assert.equal(build(restartOutput, inputChanged).status, 0);
    const restart = requestFor(restartOutput);
    assert.ok(restart.replacement);
    // Observe the native state a launcher leaves if it stops immediately after
    // installing the replacement and before retiring the previous candidate.
    fs.mkdirSync(restart.parked);
    fs.writeFileSync(
      path.join(restart.parked, "job.json"),
      JSON.stringify(restart.job),
    );
    fs.renameSync(restartOutput, path.join(restart.parked, "outputs"));
    assert.equal(fs.existsSync(accepted.parked), true);
    RuntimeBuildCache.parkRequested(run, store, canChange);
    assert.equal(fs.existsSync(accepted.parked), false);
    assert.equal(
      fs.readFileSync(path.join(restart.parked, "outputs", "main.js"), "utf8"),
      "owned build output",
    );
    RuntimeBuildCache.parkRequested(run, store, canChange);
    assert.equal(fs.existsSync(restart.parked), true);

    const variantA = generation(run);
    assert.equal(build(variantA, inputChanged, { variant: "a" }).status, 0);
    const oldA = requestFor(variantA).parked;
    RuntimeBuildCache.parkRequested(run, store, canChange);
    const variantB = generation(run);
    assert.equal(build(variantB, inputChanged, { variant: "b" }).status, 0);
    const oldB = requestFor(variantB).parked;
    RuntimeBuildCache.parkRequested(run, store, canChange);
    assert.notEqual(path.dirname(oldB), path.dirname(oldA));
    const nativeIdentity = (directory: string): string => {
      const entry = fs.lstatSync(directory, { bigint: true });
      return `${entry.dev}:${entry.ino}`;
    };
    const nextA = generation(run);
    assert.equal(build(nextA, inputChanged, { variant: "a" }).status, 0);
    const replay = requestFor(nextA);
    assert.ok(replay.replacement);
    assert.ok(
      replay.replacement.prior.some(({ directory }) => directory === oldA),
    );
    assert.equal(
      replay.replacement.prior.some(({ directory }) => directory === oldB),
      false,
    );
    fs.mkdirSync(replay.parked);
    fs.writeFileSync(
      path.join(replay.parked, "job.json"),
      JSON.stringify(replay.job),
    );
    fs.renameSync(nextA, path.join(replay.parked, "outputs"));
    fs.writeFileSync(
      path.join(parks, "replay-other-variant.json"),
      JSON.stringify({
        ...replay,
        replacement: {
          ...replay.replacement,
          prior: [
            ...replay.replacement.prior,
            {
              directory: oldB,
              identity:
                nativeIdentity(oldB) +
                "/" +
                nativeIdentity(path.join(oldB, "outputs")),
            },
          ],
        },
      }),
    );
    RuntimeBuildCache.parkRequested(run, store, canChange);
    assert.equal(fs.existsSync(oldA), false);
    assert.equal(
      fs.readFileSync(path.join(oldB, "outputs", "main.js"), "utf8"),
      "owned build output",
    );

    const recordAddress = pending.replace(/\.pending$/, ".json");
    const bundleAddress = pending.replace(/\.pending$/, ".bundle");
    fs.mkdirSync(recordAddress);
    for (const expectRecord of [false, true]) {
      const inline = generation(run);
      assert.equal(
        build(
          inline,
          (emit) => (emit === inline ? undefined : "input changed"),
          { mode: "inline" },
        ).status,
        0,
      );
      assert.ok(fs.lstatSync(bundleAddress).isFile());
      assert.equal(fs.lstatSync(recordAddress).isFile(), expectRecord);
      assert.equal(
        fs.readFileSync(
          path.join(restart.parked, "outputs", "main.js"),
          "utf8",
        ),
        "owned build output",
      );
      if (!expectRecord) fs.rmdirSync(recordAddress);
    }

    const fallback = path.join(pending, `1-1-${crypto.randomUUID()}`);
    fs.cpSync(restart.parked, fallback, { recursive: true });
    const deferred = generation(run);
    const beforeDeferred = builds;
    assert.equal(build(deferred, undefined, { mode: "defer" }).status, 0);
    assert.equal(builds, beforeDeferred);
    assert.equal(fs.existsSync(restart.parked), false);
    assert.equal(
      fs.readFileSync(path.join(deferred, "main.js"), "utf8"),
      "owned build output",
    );
    assert.equal(
      fs.readFileSync(path.join(fallback, "outputs", "main.js"), "utf8"),
      "owned build output",
    );
  } finally {
    fs.rmSync(root, { recursive: true });
  }
}
