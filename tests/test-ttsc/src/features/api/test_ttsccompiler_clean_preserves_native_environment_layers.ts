import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { TtscCompiler } from "../../../../../packages/ttsc/src/TtscCompiler";

/**
 * Verifies cleanup preserves constructor environment authority under native
 * variable-name identity, including caller-owned Go cache protection.
 *
 * Every candidate is an independently seeded disposable directory. Windows
 * aliases must override the ambient layer; POSIX aliases stay separate. The
 * constructor captures its input before the test mutates the original object.
 *
 * 1. Seed ambient, constructor and default cache roots for each selector row.
 * 2. Clean each captured instance and collect every independent outcome.
 * 3. Clean two captured instances independently and protect a user cache
 *    inside an explicit whole root.
 * 4. Distinguish requested reports from physical deletion through a real parent
 *    alias, including relative selectors and protected overlap.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls actual TtscCompiler.clean on seeded disposable directories and asserts exact removed paths, surviving unselected caches, captured constructor values, unchanged ambient state and preserved user GOCACHE overlap.
 * @evidence contracts/testing.md#independent-expectations Literal native-name layer precedence and the public explicit/default cache ownership contract select independently seeded paths. Absolute selectors retain their requested reporting spelling; project-derived defaults and relative selectors use the independently observed physical project. Node realpaths captured before deletion separately establish deletion and survival identities without using the cleanup planner as an oracle.
 * @evidence contracts/testing.md#distinguishing-cases Exact, lowercase, mixed, absent, undefined, blank and duplicate spelling rows distinguish layer authority and within-layer lexical selection. POSIX expects differently cased names to remain independent. Sequential instances retain their own captured selections; an explicit root overlapping selected user GOCACHE remains intact while an unrelated legacy cache is removed. A native parent symlink/junction makes requested and physical cache paths differ on every platform; absolute reports preserve the alias, relative reports use the physical project, and caller-cache overlap still protects the same physical tree.
 * @evidence contracts/testing.md#execution-ownership A discoverable source unit invokes cleanup in process without a compiler, native producer, installed consumer or host. Only owned os.tmpdir fixtures can be removed; scoped ambient test inputs restore in finally and the product must leave them unchanged.
 */
export function test_ttsccompiler_clean_preserves_native_environment_layers(): void {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ttsc-native-env-clean-"));
  const names = ["TTSC_CACHE_DIR", "TTSC_GO_CACHE_DIR", "GOCACHE"] as const;
  const saved = Object.fromEntries(
    names.map((name) => [name, process.env[name]]),
  );
  const failures: Error[] = [];
  const check = (name: string, operation: () => void): void => {
    try {
      operation();
    } catch (cause) {
      failures.push(new Error(name, { cause }));
    }
  };
  const seed = (directory: string): string => {
    fs.mkdirSync(directory, { recursive: true });
    fs.writeFileSync(path.join(directory, "sentinel"), "preserve unselected\n");
    return fs.realpathSync(directory);
  };
  try {
    for (const spelling of [
      "exact",
      "lower",
      "mixed",
      "absent",
      "undefined",
      "blank",
      "duplicate",
      "duplicate-undefined",
    ] as const) {
      check(spelling, () => {
        const project = path.join(root, spelling);
        fs.mkdirSync(project);
        fs.writeFileSync(path.join(project, "package.json"), '{"private":true}');
        fs.writeFileSync(path.join(project, "tsconfig.json"), "{}");
        const source = path.join(project, "main.ts");
        fs.writeFileSync(source, "export const intact = 42;\n");
        const ambient = path.join(project, "ambient");
        const selected = path.join(project, "selected");
        const defaults = path.join(project, "node_modules/.cache/ttsc");
        const ambientGo = path.join(project, "ambient-go");
        const selectedGo = path.join(project, "selected-go");
        const ambientUser = path.join(project, "ambient-user");
        const selectedUser = path.join(project, "selected-user");
        const pluginPaths = new Map(
          [ambient, selected, defaults].map((cache) => [
            cache,
            seed(path.join(cache, "plugins")),
          ]),
        );
        const goPaths = new Map(
          [ambientGo, selectedGo, path.join(defaults, "go-build")].map(
            (cache) => [cache, seed(cache)],
          ),
        );
        seed(ambientUser);
        seed(selectedUser);
        process.env.TTSC_CACHE_DIR = ambient;
        process.env.TTSC_GO_CACHE_DIR = ambientGo;
        process.env.GOCACHE = ambientUser;
        const env: NodeJS.ProcessEnv = {};
        const values = [selected, selectedGo, selectedUser];
        if (spelling !== "absent")
          names.forEach((name, index) => {
            const key =
              spelling === "exact" || spelling.startsWith("duplicate")
                ? name
                : spelling === "mixed"
                  ? name[0] + name.slice(1).toLowerCase()
                  : name.toLowerCase();
            env[key] =
              spelling === "undefined" || spelling === "duplicate-undefined"
                ? undefined
                : spelling === "blank"
                  ? ""
                  : values[index];
            if (spelling.startsWith("duplicate"))
              env[name.toLowerCase()] = selectedUser;
          });
        const instance = new TtscCompiler({ cwd: project, env });
        for (const key of Object.keys(env)) env[key] = ambientUser;
        const nativeOverride =
          process.platform === "win32" ||
          spelling === "exact" ||
          spelling.startsWith("duplicate");
        const reset =
          nativeOverride &&
          ["undefined", "blank", "duplicate-undefined"].includes(spelling);
        const chosen =
          spelling === "absent" || !nativeOverride
            ? ambient
            : reset
              ? defaults
              : selected;
        const chosenGo =
          spelling === "absent" || !nativeOverride
            ? ambientGo
            : reset
              ? path.join(defaults, "go-build")
              : selectedGo;
        const expected = [
          chosen === defaults
            ? pluginPaths.get(chosen)!
            : path.join(chosen, "plugins"),
          chosenGo === path.join(defaults, "go-build")
            ? goPaths.get(chosenGo)!
            : chosenGo,
        ];
        const removed = instance.clean();
        assert.deepEqual(removed, expected);
        for (const [cache, physical] of pluginPaths)
          assert.equal(
            fs.existsSync(physical),
            cache !== chosen,
            spelling + ": " + cache,
          );
        for (const [cache, physical] of goPaths)
          assert.equal(
            fs.existsSync(physical),
            cache !== chosenGo,
            spelling + ": " + cache,
          );
        for (const cache of [ambientUser, selectedUser])
          assert.equal(
            fs.readFileSync(path.join(cache, "sentinel"), "utf8"),
            "preserve unselected\n",
          );
        assert.equal(
          fs.readFileSync(source, "utf8"),
          "export const intact = 42;\n",
        );
        assert.deepEqual(
          names.map((name) => process.env[name]),
          [ambient, ambientGo, ambientUser],
        );
      });
    }
    check("independent captured instances", () => {
      const project = path.join(root, "instances");
      fs.mkdirSync(project);
      fs.writeFileSync(path.join(project, "tsconfig.json"), "{}");
      const firstRoot = path.join(project, "first");
      const secondRoot = path.join(project, "second");
      const ambientRoot = path.join(project, "ambient");
      const firstPlugin = seed(path.join(firstRoot, "plugins"));
      const secondPlugin = seed(path.join(secondRoot, "plugins"));
      const ambientPlugin = seed(path.join(ambientRoot, "plugins"));
      process.env.TTSC_CACHE_DIR = ambientRoot;
      const firstEnv = {
        ttsc_cache_dir: firstRoot,
        TTSC_GO_CACHE_DIR: undefined,
        GOCACHE: "",
      };
      const secondEnv = {
        TTSC_CACHE_DIR: secondRoot,
        TTSC_GO_CACHE_DIR: undefined,
        GOCACHE: "",
      };
      const first = new TtscCompiler({ cwd: project, env: firstEnv });
      const second = new TtscCompiler({ cwd: project, env: secondEnv });
      firstEnv.ttsc_cache_dir = secondRoot;
      secondEnv.TTSC_CACHE_DIR = firstRoot;
      assert.deepEqual(
        first.clean(),
        [path.join(process.platform === "win32" ? firstRoot : ambientRoot, "plugins")],
      );
      assert.equal(fs.existsSync(secondPlugin), true);
      assert.deepEqual(second.clean(), [path.join(secondRoot, "plugins")]);
      assert.equal(fs.existsSync(firstPlugin), process.platform !== "win32");
      assert.equal(fs.existsSync(ambientPlugin), process.platform === "win32");
      assert.equal(process.env.TTSC_CACHE_DIR, ambientRoot);
    });
    check("explicit root protects selected user cache", () => {
      const project = path.join(root, "protected");
      fs.mkdirSync(project);
      fs.writeFileSync(path.join(project, "tsconfig.json"), "{}");
      const whole = path.join(project, "explicit");
      const user = path.join(whole, "user-go");
      seed(user);
      const legacy = seed(path.join(project, ".ttsc"));
      const ambientUser = path.join(project, "ambient-user");
      seed(ambientUser);
      process.env.GOCACHE = ambientUser;
      const compiler = new TtscCompiler({
        cwd: project,
        cacheDir: whole,
        env: { gocache: user, TTSC_GO_CACHE_DIR: undefined },
      });
      const removed = compiler.clean();
      assert.deepEqual(
        removed,
        process.platform === "win32" ? [legacy] : [whole, legacy],
      );
      assert.equal(fs.existsSync(user), process.platform === "win32");
      assert.equal(
        fs.readFileSync(path.join(ambientUser, "sentinel"), "utf8"),
        "preserve unselected\n",
      );
      assert.equal(process.env.GOCACHE, ambientUser);
    });
    check("linked parent separates reporting and deletion", () => {
      const project = path.join(root, "linked-project");
      fs.mkdirSync(project);
      fs.writeFileSync(path.join(project, "package.json"), '{"private":true}');
      fs.writeFileSync(path.join(project, "tsconfig.json"), "{}");
      const source = path.join(project, "main.ts");
      fs.writeFileSync(source, "export const intact = 42;\n");
      const physicalProject = fs.realpathSync(project);
      const alias = path.join(root, "project-alias");
      fs.symlinkSync(
        physicalProject,
        alias,
        process.platform === "win32" ? "junction" : "dir",
      );
      assert.equal(fs.lstatSync(alias).isSymbolicLink(), true);
      assert.equal(fs.realpathSync(alias), physicalProject);
      assert.notEqual(alias, physicalProject);
      const selected = path.join(alias, "selected");
      const selectedGo = path.join(alias, "selected-go");
      const unselected = path.join(alias, "unselected");
      const user = path.join(unselected, "user-go");
      const physicalPlugin = seed(path.join(selected, "plugins"));
      const physicalGo = seed(selectedGo);
      const physicalUnselected = seed(path.join(unselected, "plugins"));
      const physicalUser = seed(user);
      assert.notEqual(path.join(selected, "plugins"), physicalPlugin);
      assert.notEqual(selectedGo, physicalGo);
      const ambient = names.map((name) => process.env[name]);
      assert.deepEqual(
        new TtscCompiler({
          cwd: alias,
          env: {
            TTSC_CACHE_DIR: selected,
            TTSC_GO_CACHE_DIR: selectedGo,
            GOCACHE: user,
          },
        }).clean(),
        [path.join(selected, "plugins"), selectedGo],
      );
      assert.equal(fs.existsSync(physicalPlugin), false);
      assert.equal(fs.existsSync(physicalGo), false);
      seed(path.join(selected, "plugins"));
      seed(selectedGo);
      assert.deepEqual(
        new TtscCompiler({
          cwd: alias,
          env: {
            TTSC_CACHE_DIR: "selected",
            TTSC_GO_CACHE_DIR: "selected-go",
            GOCACHE: user,
          },
        }).clean(),
        [physicalPlugin, physicalGo],
      );
      assert.equal(fs.existsSync(physicalPlugin), false);
      assert.equal(fs.existsSync(physicalGo), false);
      assert.deepEqual(
        new TtscCompiler({
          cwd: alias,
          cacheDir: unselected,
          env: { TTSC_GO_CACHE_DIR: undefined, GOCACHE: user },
        }).clean(),
        [],
      );
      for (const directory of [physicalUnselected, physicalUser])
        assert.equal(
          fs.readFileSync(path.join(directory, "sentinel"), "utf8"),
          "preserve unselected\n",
        );
      assert.equal(fs.readFileSync(source, "utf8"), "export const intact = 42;\n");
      assert.deepEqual(names.map((name) => process.env[name]), ambient);
    });
    if (failures.length)
      throw new AggregateError(failures, "native environment cleanup rows");
  } finally {
    for (const name of names) {
      if (saved[name] === undefined) delete process.env[name];
      else process.env[name] = saved[name];
    }
    fs.rmSync(root, { recursive: true, force: true });
  }
}
