import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

interface Observation {
  complete: boolean;
  hashes: Record<string, string | null>;
  inputs: string[];
  realpaths: Record<string, string | null>;
}
interface Recorder {
  beginResolution(specifier: string, parent: string): unknown;
  endResolution(token: unknown, selected: string | undefined): void;
  finish(): Observation;
}
const { createResolutionInputRecorder } = createRequire(import.meta.url)(
  fileURLToPath(
    new URL(
      "../../../../../packages/ttsc/driver/resolutioninputs/recorder.cjs",
      import.meta.url,
    ),
  ),
) as {
  createResolutionInputRecorder(options: { extensions: string[] }): Recorder;
};

/**
 * Verifies mapped resolutions cannot replace an earlier witness with later state.
 *
 * Node selects actual owned modules between recorder begin/end calls. Changes
 * in that window must withdraw proof while stable selected-and-nearer inputs
 * retain their independently computed content and absence observations.
 *
 * 1. Resolve scoped, unscoped, conditional and subpath mappings through Node.
 * 2. Create nearer packages or mutate local/linked inputs in the phase window.
 * 3. Contrast stable reusable proof with changed and failed-resolution inputs.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls the shared production recorder around actual createRequire.resolve, then checks its final input/proof envelope. The nearer scoped creation is inside an existing scope directory, the missing witness that post-resolution root metadata cannot recover.
 * @evidence contracts/testing.md#independent-expectations Node supplies selected paths; SHA-256 over literal authored bytes and native realpath supply stable proof expectations. Changed inputs must remain listed without either reusable proof, never acquire the later bytes as an earlier observation.
 * @evidence contracts/testing.md#distinguishing-cases Covers stable/moved scoped and unscoped mappings, direct scoped resolution, subpaths, conditional unrelated targets, local byte mutation, linked target replacement, caught missing resolution and repeated first-witness authority. Stable selected-root cutoff excludes farther packages.
 * @evidence contracts/testing.md#execution-ownership One discoverable source unit exercises recorder and Node resolution over owned files in process. It installs no consumer or hook, builds no native artifact, and does not claim descriptor or embedded-host acceptance. Cases aggregate failures and cleanup owns only the fresh root.
 */
export function test_resolution_input_recorder_preserves_mapped_resolution_witnesses(): void {
  const root = fs.realpathSync.native(
    fs.mkdtempSync(path.join(os.tmpdir(), "ttsc-mapped-witness-")),
  );
  const failures: Error[] = [];
  const write = (file: string, bytes: string): void => {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, bytes);
  };
  const packageAt = (directory: string, value: string): string => {
    write(path.join(directory, "package.json"), '{"main":"index.cjs"}');
    const file = path.join(directory, "index.cjs");
    write(file, value);
    return file;
  };
  const digest = (value: string): string =>
    crypto.createHash("sha256").update(value).digest("hex");
  const refused = (result: Observation, file: string): void => {
    assert.ok(result.inputs.includes(file), file);
    assert.equal(Object.hasOwn(result.hashes, file), false, file);
    assert.equal(Object.hasOwn(result.realpaths, file), false, file);
    assert.equal(result.complete, true);
  };
  const check = (name: string, run: (directory: string) => void): void => {
    try {
      run(path.join(root, name));
    } catch (cause) {
      failures.push(new Error(name, { cause }));
    }
  };
  try {
    for (const [name, target, mapped, mutate] of [
      ["mapped-scoped-stable", "@scope/pkg", true, false],
      ["mapped-scoped-created", "@scope/pkg", true, true],
      ["direct-scoped-created", "@scope/pkg", false, true],
      ["mapped-unscoped-created", "pkg", true, true],
      ["mapped-subpath-created", "@scope/pkg/sub.cjs", true, true],
    ] as const)
      check(name, (directory) => {
        const app = path.join(directory, "app");
        const parent = path.join(app, "entry.cjs");
        write(parent, "// importer");
        write(path.join(app, "package.json"), JSON.stringify({ imports: { "#dep": target } }));
        const packageName = target.startsWith("@") ? "@scope/pkg" : "pkg";
        const near = path.join(app, "node_modules", packageName);
        fs.mkdirSync(path.dirname(near), { recursive: true });
        const far = path.join(directory, "node_modules", packageName);
        const farEntry = packageAt(far, "module.exports='FAR';");
        if (target.endsWith("/sub.cjs")) write(path.join(far, "sub.cjs"), "module.exports='SUB';");
        const recorder = createResolutionInputRecorder({ extensions: [".cjs", ".js", ".json", ".node"] });
        const specifier = mapped ? "#dep" : target;
        const token = recorder.beginResolution(specifier, parent);
        const selected = createRequire(parent).resolve(specifier);
        assert.equal(selected, target.endsWith("/sub.cjs") ? path.join(far, "sub.cjs") : farEntry);
        if (mutate) {
          packageAt(near, "module.exports='NEAR';");
          if (target.endsWith("/sub.cjs")) write(path.join(near, "sub.cjs"), "module.exports='NEAR-SUB';");
        }
        recorder.endResolution(token, selected);
        const result = recorder.finish();
        for (const file of [path.join(near, "package.json"), path.join(near, "index.cjs")]) {
          if (mutate) refused(result, file);
          else {
            assert.equal(result.hashes[file], null);
            assert.equal(result.realpaths[file], null);
          }
        }
        if (mutate && target.endsWith("/sub.cjs")) refused(result, path.join(near, "sub.cjs"));
        if (!mutate) {
          assert.equal(result.hashes[farEntry], digest("module.exports='FAR';"));
          assert.equal(result.realpaths[farEntry], fs.realpathSync.native(farEntry));
          assert.equal(result.complete, true);
          assert.ok(!result.inputs.includes(path.join(root, "node_modules", packageName, "package.json")));
        }
      });
    check("conditional-cutoff", (directory) => {
      const parent = path.join(directory, "app", "entry.cjs");
      write(parent, "// importer");
      write(path.join(directory, "app", "package.json"), JSON.stringify({ imports: { "#dep": { require: "@scope/pkg", default: "unused" } } }));
      const selected = packageAt(path.join(directory, "node_modules", "@scope/pkg"), "module.exports=1;");
      const recorder = createResolutionInputRecorder({ extensions: [".cjs", ".js"] });
      const token = recorder.beginResolution("#dep", parent);
      assert.equal(createRequire(parent).resolve("#dep"), selected);
      recorder.endResolution(token, selected);
      const result = recorder.finish();
      assert.equal(result.hashes[selected], digest("module.exports=1;"));
      assert.ok(!result.inputs.some((file) => file.includes(`${path.sep}unused`)));
    });
    check("local-changed", (directory) => {
      const parent = path.join(directory, "entry.cjs");
      const selected = path.join(directory, "local.cjs");
      write(parent, "// importer");
      write(path.join(directory, "package.json"), '{"imports":{"#dep":"./local.cjs"}}');
      write(selected, "module.exports=1;");
      const recorder = createResolutionInputRecorder({ extensions: [".cjs"] });
      const token = recorder.beginResolution("#dep", parent);
      assert.equal(createRequire(parent).resolve("#dep"), selected);
      write(selected, "module.exports=2;");
      recorder.endResolution(token, selected);
      refused(recorder.finish(), selected);
    });
    check("failed-created", (directory) => {
      const parent = path.join(directory, "entry.cjs");
      write(parent, "// importer");
      write(path.join(directory, "package.json"), '{"imports":{"#dep":"@scope/pkg"}}');
      const recorder = createResolutionInputRecorder({ extensions: [".cjs"] });
      const token = recorder.beginResolution("#dep", parent);
      assert.throws(() => createRequire(parent).resolve("#dep"));
      const selected = packageAt(path.join(directory, "node_modules", "@scope/pkg"), "module.exports=1;");
      recorder.endResolution(token, undefined);
      refused(recorder.finish(), selected);
    });
    for (const changed of [false, true])
      check(changed ? "linked-retarget" : "linked-stable", (directory) => {
        const parent = path.join(directory, "app", "entry.cjs");
        write(parent, "// importer");
        write(path.join(directory, "app", "package.json"), '{"imports":{"#dep":"@scope/pkg"}}');
        const first = path.join(directory, "first");
        const second = path.join(directory, "second");
        const selected = packageAt(first, "module.exports=1;");
        packageAt(second, "module.exports=1;");
        const link = path.join(directory, "app", "node_modules", "@scope/pkg");
        fs.mkdirSync(path.dirname(link), { recursive: true });
        fs.symlinkSync(first, link, process.platform === "win32" ? "junction" : "dir");
        const recorder = createResolutionInputRecorder({ extensions: [".cjs"] });
        const token = recorder.beginResolution("#dep", parent);
        assert.equal(createRequire(parent).resolve("#dep"), selected);
        if (changed) {
          fs.unlinkSync(link);
          fs.symlinkSync(second, link, process.platform === "win32" ? "junction" : "dir");
        }
        recorder.endResolution(token, selected);
        const result = recorder.finish();
        if (changed) refused(result, path.join(link, "index.cjs"));
        else {
          const file = path.join(link, "index.cjs");
          assert.equal(result.hashes[file], digest("module.exports=1;"));
          assert.equal(result.realpaths[file], fs.realpathSync.native(selected));
          assert.equal(result.complete, true);
        }
      });
    check("repeated-first-witness", (directory) => {
      const parent = path.join(directory, "entry.cjs");
      write(parent, "// importer");
      write(path.join(directory, "package.json"), '{"imports":{"#dep":"./local.cjs"}}');
      const selected = path.join(directory, "local.cjs");
      write(selected, "module.exports=1;");
      const recorder = createResolutionInputRecorder({ extensions: [".cjs"] });
      const first = recorder.beginResolution("#dep", parent);
      recorder.endResolution(first, createRequire(parent).resolve("#dep"));
      write(selected, "module.exports=2;");
      const second = recorder.beginResolution("#dep", parent);
      recorder.endResolution(second, createRequire(parent).resolve("#dep"));
      refused(recorder.finish(), selected);
    });
  } finally {
    try {
      fs.rmSync(root, { recursive: true, force: true });
    } catch (cause) {
      failures.push(new Error("owned root cleanup", { cause }));
    }
  }
  if (failures.length !== 0)
    throw new AggregateError(failures, "Mapped resolution witnesses");
}
