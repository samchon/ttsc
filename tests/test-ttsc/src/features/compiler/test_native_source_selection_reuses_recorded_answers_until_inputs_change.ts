import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { NativeSourcePackages } from "../../../../../packages/ttsc/src/plugin/internal/source/NativeSourcePackages";
import { PluginContentIdentities } from "../../../../../packages/ttsc/src/plugin/internal/source/PluginContentIdentities";
import { TestProject } from "../../../../utils/src/TestProject";

/**
 * Verifies a Go package selection is answered from its record only while every
 * input Go's selection reads is unchanged.
 *
 * A warm load used to copy the plugin module and run `go list` twice on every
 * launch (#1721). The recorded answer is keyed by the content of the module,
 * overlays and contributors, the toolchain and every Go variable; any change
 * must observe Go again, and a selection Go reported as erroneous must never be
 * recorded. Rewriting only the recorded package name distinguishes an answer
 * read from the record from one Go produced.
 *
 * 1. Select a nested entry, corrupt the recorded name and select again through a
 *    reopened store; the corrupted name proves Go did not run.
 * 2. Edit the entry's source, then change GOFLAGS, then select in proposal mode;
 *    each must observe Go and record a separate answer.
 * 3. Select a directory without Go files; its error must not be recorded.
 *
 * @evidence contracts/testing.md#behavioral-verification NativeSourcePackages.ownPackages and propose run with a real record store and the selected Go toolchain; the returned package records and the answer files on disk are asserted.
 * @evidence contracts/testing.md#independent-expectations The authored `package main` and the literal corrupted name are the oracles; Go's own Error field marks the erroneous selection.
 * @evidence contracts/testing.md#distinguishing-cases Unchanged inputs reuse; a source edit, a GOFLAGS change and proposal mode each produce a new answer; an erroneous selection records nothing. Overlay and contributor changes follow the same digest rule covered by the content identity unit.
 * @evidence contracts/testing.md#execution-ownership The named unit calls the selection owner directly over a copied fixture module; real `go list` metadata runs, but no plugin binary is built and no product host starts.
 */
export function test_native_source_selection_reuses_recorded_answers_until_inputs_change(): void {
  const root = TestProject.physicalPath(
    TestProject.tmpdir("ttsc-selection-answers-"),
  );
  TestProject.copyDirectory(
    path.join(
      TestProject.WORKSPACE_ROOT,
      "packages",
      "ttsc",
      "test",
      "fixtures",
      "unit",
      "native_source_selection_reuses_recorded_answers_until_inputs_change",
      "inputs-1",
    ),
    root,
  );
  const module = path.join(root, "plugin");
  const tool = path.join(module, "cmd", "tool");
  const main = path.join(tool, "main.go");
  fs.renameSync(`${main}.txt`, main);
  const cache = path.join(root, "cache");
  const answers = path.join(cache, "answers");
  const settle = (): void => {
    const past = new Date(Date.now() - 3_600_000);
    for (const file of listFiles(module)) fs.utimesSync(file, past, past);
  };
  const open = (): PluginContentIdentities.Store => {
    const store = PluginContentIdentities.open({
      projectRoot: root,
      cacheDir: cache,
      env: process.env,
    });
    assert.ok(store);
    return store;
  };
  const selections = (): string[] =>
    fs.existsSync(answers)
      ? fs
          .readdirSync(answers)
          .filter((name) => name.endsWith(".json"))
          .map((name) => path.join(answers, name))
          .filter((file) =>
            JSON.stringify(JSON.parse(fs.readFileSync(file, "utf8"))).includes(
              '"GoFiles"',
            ),
          )
      : [];
  const own = (env: NodeJS.ProcessEnv = process.env) =>
    NativeSourcePackages.ownPackages(
      [{ source: tool, label: "tool" }],
      env,
      undefined,
      open(),
    )[0]!;
  const failures: unknown[] = [];
  const verify = (name: string, run: () => void): void => {
    try {
      run();
    } catch (cause) {
      failures.push(new Error(name, { cause }));
    }
  };

  settle();
  verify("a cold selection runs Go and records its answer", () => {
    const observed = own();
    assert.equal(observed.Name, "main");
    assert.deepEqual(observed.GoFiles, ["main.go"]);
    assert.equal(selections().length, 1);
  });
  verify("unchanged inputs answer from the record", () => {
    const [file] = selections();
    const entry = JSON.parse(fs.readFileSync(file!, "utf8")) as {
      value: Array<{ Name: string }>;
    };
    entry.value[0]!.Name = "recorded";
    fs.writeFileSync(file!, JSON.stringify(entry));
    assert.equal(own().Name, "recorded");
  });
  verify("an edited entry observes Go again", () => {
    fs.writeFileSync(main, "package main\n\nfunc main() { _ = 1 }\n");
    settle();
    assert.equal(own().Name, "main");
    assert.equal(selections().length, 2);
  });
  verify("a changed Go variable observes Go again", () => {
    assert.equal(
      own({ ...process.env, GOFLAGS: "-tags=selection" }).Name,
      "main",
    );
    assert.equal(selections().length, 3);
  });
  verify("proposal mode keeps its own answer", () => {
    const [proposal] = NativeSourcePackages.propose(
      [{ source: tool, label: "tool" }],
      process.env,
      undefined,
      open(),
    );
    assert.equal(proposal!.observation.Name, "main");
    assert.equal(selections().length, 4);
  });
  verify("an erroneous selection is never recorded", () => {
    const [empty] = NativeSourcePackages.ownPackages(
      [{ source: path.join(module, "cmd", "empty"), label: "empty" }],
      process.env,
      undefined,
      open(),
    );
    assert.ok(empty!.Error, "Go reports a directory without Go files");
    assert.equal(selections().length, 4);
  });
  if (failures.length !== 0)
    throw new AggregateError(
      failures,
      "package selection answer matrix failed",
    );
}

function listFiles(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const location = path.join(directory, entry.name);
    return entry.isDirectory() ? listFiles(location) : [location];
  });
}
