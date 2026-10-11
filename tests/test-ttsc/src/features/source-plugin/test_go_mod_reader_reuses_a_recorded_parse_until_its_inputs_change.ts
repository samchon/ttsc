import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { GoToolResolution } from "../../../../../packages/ttsc/src/plugin/internal/source/GoToolResolution";
import { PluginContentIdentities } from "../../../../../packages/ttsc/src/plugin/internal/source/PluginContentIdentities";
import { SourcePluginWorkspace } from "../../../../../packages/ttsc/src/plugin/internal/source/SourcePluginWorkspace";
import { resolveGoCompiler } from "../../../../../packages/ttsc/src/plugin/internal/source/resolveGoCompiler";
import { TestProject } from "../../../../utils/src/TestProject";

/**
 * Verifies a `go.mod` parse is answered from the record store only while the
 * manifest bytes, the Go command and its environment are unchanged.
 *
 * WARNING (#1729): every plugin load whose module declares a `replace` ran `go
 * mod edit -json` on its unchanged manifest. The recorded parse is keyed by the
 * bytes, both Go executables, the `GOENV` file and the Go variables; any change
 * must run Go again, and a failed parse must never be recorded. Rewriting only
 * the recorded module path distinguishes an answer read from the record from
 * one Go produced.
 *
 * 1. Parse once, corrupt the recorded module path and parse through a new reader
 *    and a reopened store: the corrupted path proves Go did not run.
 * 2. With every record corrupted, edit the manifest, change GOFLAGS, change the
 *    GOENV file's bytes, and read without a store: each must parse again.
 * 3. A manifest Go rejects throws and records nothing.
 *
 * The record is keyed only by executables the store can prove from metadata, so
 * the private cache root lives below the checkout's ignored `.cache`, on the
 * device of the Go toolchain the suite installed; a Windows runner's system
 * temporary directory is on another drive. The premise is asserted first.
 *
 * @evidence contracts/testing.md#behavioral-verification Real readers run the selected Go toolchain against real manifests and a real record store; the returned module path, directives and the answer files on disk are asserted.
 * @evidence contracts/testing.md#independent-expectations The authored module path and replace directives are the oracles for a Go parse; the corrupted literal is the oracle for a recorded one.
 * @evidence contracts/testing.md#distinguishing-cases Unchanged inputs reuse; a manifest edit, a GOFLAGS change, a GOENV file change and a store-less reader each parse; a rejected manifest records nothing.
 * @evidence contracts/testing.md#execution-ownership The named unit owns its temporary module, GOENV file and private cache root and calls the reader directly; `go env` and `go mod edit` run, no plugin is built and no product host starts.
 */
export function test_go_mod_reader_reuses_a_recorded_parse_until_its_inputs_change(): void {
  const root = TestProject.physicalPath(
    TestProject.tmpdir(
      "ttsc-go-mod-answers-",
      path.join(TestProject.WORKSPACE_ROOT, ".cache"),
    ),
  );
  const module = path.join(root, "plugin");
  fs.mkdirSync(module, { recursive: true });
  const manifest = path.join(module, "go.mod");
  const authored =
    "module example.com/plugin\n\ngo 1.24\n\nreplace example.com/dep => ../dep\n";
  fs.writeFileSync(manifest, authored);
  const goEnvFile = path.join(root, "go.env");
  fs.writeFileSync(goEnvFile, "");
  const cache = path.join(root, "cache");
  const answers = path.join(cache, "answers");
  const baseEnv: NodeJS.ProcessEnv = { ...process.env, GOENV: goEnvFile };
  const open = (): PluginContentIdentities.Store => {
    const store = PluginContentIdentities.open({
      projectRoot: root,
      cacheDir: cache,
      env: baseEnv,
    });
    assert.ok(store);
    return store;
  };
  const tool = (env: NodeJS.ProcessEnv = baseEnv): string =>
    GoToolResolution.resolveGoToolForBuild(
      resolveGoCompiler(env).binary,
      env,
      module,
    );
  const read = (env: NodeJS.ProcessEnv = baseEnv, withStore = true) => {
    const goBinary = tool(env);
    return SourcePluginWorkspace.createGoModReader(
      goBinary,
      "plugin",
      env,
      undefined,
      withStore ? open() : undefined,
    ).read(module);
  };
  const records = (): string[] =>
    fs.existsSync(answers)
      ? fs
          .readdirSync(answers)
          .filter((name) => name.endsWith(".json"))
          .map((name) => path.join(answers, name))
          .filter((file) =>
            fs.readFileSync(file, "utf8").includes('"directives"'),
          )
      : [];
  const corrupted = "corrupted.example/recorded";
  const corruptAll = (): void => {
    for (const file of records()) {
      const entry = JSON.parse(fs.readFileSync(file, "utf8")) as {
        value: { modulePath: string };
      };
      entry.value.modulePath = corrupted;
      fs.writeFileSync(file, JSON.stringify(entry));
    }
  };
  const failures: unknown[] = [];
  const verify = (name: string, run: () => void): void => {
    try {
      run();
    } catch (cause) {
      failures.push(new Error(name, { cause }));
    }
  };

  assert.ok(
    PluginContentIdentities.separable(
      open().references,
      fs.statSync(tool(), { bigint: true }),
    ),
    "premise: the suite's Go launcher lies on a device the store references",
  );
  verify("an unchanged manifest is answered from its record", () => {
    const parsed = read();
    assert.equal(parsed.modulePath, "example.com/plugin");
    assert.equal(parsed.directives.length, 1);
    assert.equal(records().length, 1, "one parse, one record");
    corruptAll();
    const recalled = read();
    assert.equal(recalled.modulePath, corrupted);
    assert.deepEqual(recalled.directives, parsed.directives);
    assert.deepEqual(recalled.replacements, parsed.replacements);
  });
  verify("an edited manifest is parsed again", () => {
    corruptAll();
    fs.writeFileSync(
      manifest,
      `${authored}replace example.com/other => ../other\n`,
    );
    const parsed = read();
    assert.equal(parsed.modulePath, "example.com/plugin");
    assert.equal(parsed.directives.length, 2);
    fs.writeFileSync(manifest, authored);
  });
  verify("a GOFLAGS change is parsed again", () => {
    read();
    corruptAll();
    assert.equal(
      read({ ...baseEnv, GOFLAGS: "-mod=mod" }).modulePath,
      "example.com/plugin",
    );
  });
  verify("a GOENV file change is parsed again", () => {
    read();
    corruptAll();
    fs.writeFileSync(goEnvFile, "GOFLAGS=-mod=mod\n");
    assert.equal(read().modulePath, "example.com/plugin");
    fs.writeFileSync(goEnvFile, "");
  });
  verify("a reader without a store parses", () => {
    read();
    corruptAll();
    assert.equal(read(baseEnv, false).modulePath, "example.com/plugin");
  });
  verify("a rejected manifest records nothing", () => {
    const before = records().length;
    fs.writeFileSync(manifest, "module example.com/plugin\n\nreplace !!!\n");
    assert.throws(() => read());
    assert.equal(records().length, before);
    fs.writeFileSync(manifest, authored);
  });

  if (failures.length !== 0)
    throw new AggregateError(failures, "go.mod parse record matrix failed");
}
