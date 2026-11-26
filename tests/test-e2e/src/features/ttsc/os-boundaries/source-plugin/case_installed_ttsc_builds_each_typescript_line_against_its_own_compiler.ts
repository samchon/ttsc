import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import childProcess from "node:child_process";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

/**
 * Verifies the installed ttsc builds a source plugin against the compiler of
 * the project's own TypeScript line, from one installation.
 *
 * Each ttsc release ships a 7.0 and a 7.1 compiler target. A project installing
 * `typescript@7.0.2` must get a plugin linked against the 7.0 compiler, and a
 * project installing the 7.1 nightly under `@typescript/native` beside legacy
 * TypeScript 6 must get one linked against the 7.1 compiler, with one cache
 * entry per target that neither reuses (samchon/ttsc#1802). The source units
 * own line mapping and environment tagging; this case runs the packed SDK,
 * whose published files must carry both targets' shims.
 *
 * 1. Lay out a 7.0 project resolving the consumer's `typescript@7.0.2` and a 7.1
 *    project installing the pinned nightly alias and TypeScript 6, beside one
 *    probe plugin.
 * 2. Check the project with the installed CLI in each; the probe records
 *    `core.Version()` of the compiler it was linked against.
 * 3. Require the two versions, two cache entries, and a second check of each that
 *    rebuilds nothing. Check that the installed SDK answer witnesses package
 *    identity without requiring metadata from every SDK file.
 * 4. Load a descriptor under a different resolver environment and verify its warm
 *    evaluation and invalidation when a real nearer candidate appears.
 *
 * @evidence contracts/testing.md#behavioral-verification The installed ttsc CLI checks each project; the probe's compiler version, plugin cache entries, absence of a second build and bounded SDK dependencies are observed. An installed loader reuses a descriptor under its evaluator's search environment and re-evaluates when a real superseding candidate appears.
 * @evidence contracts/testing.md#independent-expectations The 7.0 project expects its installed manifest version, and the 7.1 project the 7.1.0-dev version its pinned compiler declares; the nightly's gitHead must be the commit the 7.1 target pins, read from the repository's facade go.mod.
 * @evidence contracts/testing.md#distinguishing-cases The same plugin and cache exercise ordinary 7.0 discovery and the 7.1 alias beside legacy 6.0.2. The descriptor case contrasts an irrelevant parent search root with a genuine missing evaluator candidate, repeated reuse and appearance of that candidate.
 * @evidence contracts/testing.md#execution-ownership test_e2e_installation supplies its packed consumer; this case installs the 7.1 project's TypeScript and runs the installed CLI four times.
 * @evidence contracts/e2e.md#necessary-boundary Target selection, the packed shim trees and the Go workspace meet only in an installed source-plugin build; no source unit links a plugin against a compiler.
 * @evidence contracts/e2e.md#shared-execution The installation and plugin cache serve all four checks and the descriptor search case, which uses the same 7.0 executable source.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The projects live in a fresh directory below the consumer, which the entry removes; the cache directory is tracked by TestProject.
 * @evidence contracts/e2e.md#preserved-coverage A new boundary; no existing assertion moves or is removed.
 */
export function case_installed_ttsc_builds_each_typescript_line_against_its_own_compiler(input: {
  /** The packed consumer, whose root installs `typescript@7.0.2`. */
  consumer: string;

  /** The installed ttsc package directory. */
  sdk: string;

  /** The repository root, for the fixture and the 7.1 target pin. */
  repository: string;

  /** Run pnpm in a directory. */
  pnpm: (args: string[], cwd: string) => void;
}): {
  /** The project installing `typescript@7.0.2`, through the consumer. */
  readonly "7.0": string;

  /** The project installing the 7.1 nightly alias beside legacy TypeScript 6. */
  readonly "7.1": string;
} {
  const fixture = path.join(
    input.repository,
    "tests",
    "test-e2e",
    "fixtures",
    "ttsc",
    "compiler-target-probe",
  );
  // The TypeScript 7.1 nightly whose gitHead is the 7.1 target's pin. The E2E
  // workflow's 7.1 lane installs the same version from this file.
  const TYPESCRIPT_7_1 = (
    JSON.parse(
      fs.readFileSync(path.join(fixture, "typescript-7.1.json"), "utf8"),
    ) as { version: string }
  ).version;
  const root = fs.mkdtempSync(path.join(input.consumer, "compiler-target-"));
  TestProject.copyDirectory(
    path.join(fixture, "plugin"),
    path.join(root, "plugin"),
  );
  const projects = {
    "7.0": path.join(root, "typescript-7.0"),
    "7.1": path.join(root, "typescript-7.1"),
  } as const;
  for (const project of Object.values(projects))
    TestProject.copyDirectory(path.join(fixture, "project"), project);
  fs.writeFileSync(
    path.join(projects["7.1"], "package.json"),
    JSON.stringify({
      private: true,
      devDependencies: {
        typescript: "npm:@typescript/typescript6@6.0.2",
        "@typescript/native": `npm:typescript@${TYPESCRIPT_7_1}`,
      },
    }),
  );
  input.pnpm(["install", "--ignore-scripts"], projects["7.1"]);

  const manifest = (project: string, name = "typescript") =>
    JSON.parse(
      fs.readFileSync(
        path.join(project, "node_modules", name, "package.json"),
        "utf8",
      ),
    ) as { version: string; gitHead?: string };
  const pin =
    /github\.com\/microsoft\/TypeScript\/tsc v\S+-([0-9a-f]{12})\b/.exec(
      fs.readFileSync(
        path.join(
          input.repository,
          "packages",
          "ttsc",
          "targets",
          "7.1",
          "facade",
          "core",
          "go.mod",
        ),
        "utf8",
      ),
    )?.[1];
  assert.ok(pin, "the 7.1 target pins a TypeScript/tsc commit");
  assert.equal(manifest(projects["7.1"]).version, "6.0.2");
  assert.equal(
    manifest(projects["7.1"], "@typescript/native").version,
    TYPESCRIPT_7_1,
  );
  assert.equal(
    manifest(projects["7.1"], "@typescript/native").gitHead?.slice(0, 12),
    pin,
    `${TYPESCRIPT_7_1} must be the nightly of the 7.1 target's pinned commit`,
  );
  const expected = {
    "7.0": manifest(input.consumer).version,
    "7.1": "7.1.0-dev",
  } as const;
  assert.equal(expected["7.0"], "7.0.2");

  const cache = TestProject.tmpdir("ttsc-compiler-target-cache-");
  const env: NodeJS.ProcessEnv = { ...process.env, TTSC_CACHE_DIR: cache };
  delete env.TTSC_TSGO_BINARY;
  delete env.TTSC_GO_BINARY;
  delete env.GOROOT;
  const entries = () =>
    fs
      .readdirSync(path.join(cache, "plugins"))
      .filter((name) => /^[0-9a-f]{32}$/.test(name))
      .sort();
  const check = (line: keyof typeof projects) => {
    const record = path.join(projects[line], "compiler-version.txt");
    fs.rmSync(record, { force: true });
    const result = childProcess.spawnSync(
      process.execPath,
      [path.join(input.sdk, "lib", "launcher", "ttsc.js")],
      { cwd: projects[line], encoding: "utf8", env },
    );
    assert.equal(
      result.status,
      0,
      `ttsc in the ${line} project:\n${result.stdout}\n${result.stderr}`,
    );
    assert.equal(fs.readFileSync(record, "utf8"), expected[line]);
    return result.stderr;
  };

  for (const line of ["7.0", "7.1"] as const)
    assert.match(check(line), /building source plugin "compiler-target-probe"/);
  const built = entries();
  assert.equal(built.length, 2, `one entry per target: ${built.join(", ")}`);
  for (const line of ["7.1", "7.0"] as const)
    assert.doesNotMatch(
      check(line),
      /building source plugin/,
      `the ${line} project reuses its own target's entry`,
    );
  assert.deepEqual(entries(), built);

  const fromInstalledTtsc = createRequire(path.join(input.sdk, "package.json"));
  const goBinary = fs.realpathSync.native(
    fromInstalledTtsc.resolve(
      `@ttsc/${process.platform}-${process.arch}/bin/go/bin/${process.platform === "win32" ? "go.exe" : "go"}`,
    ),
  );
  const goRoot = path.resolve(goBinary, "../..");
  const goVersion = path.join(goRoot, "VERSION");
  const goManifest = path.resolve(goRoot, "../../package.json");
  const answers = path.join(cache, "answers");
  const bundledAnswers = fs
    .readdirSync(answers)
    .filter((file) => file.endsWith(".json"))
    .map((file) =>
      JSON.parse(fs.readFileSync(path.join(answers, file), "utf8")),
    )
    .filter((answer) => answer.kind === "plugin-build-environment")
    .map(
      (answer) =>
        new Set<string>(
          answer.value.witness.map(([file]: [string, string]) => file),
        ),
    )
    .filter((witness) => witness.has(goVersion));
  assert.ok(
    bundledAnswers.length > 0,
    "an installed SDK has a reusable environment answer",
  );
  for (const witness of bundledAnswers) {
    assert.ok(
      witness.has(goManifest),
      "the SDK answer depends on the installed package version",
    );
    const observed = [...witness].filter((file) =>
      file.startsWith(goRoot + path.sep),
    );
    assert.ok(
      observed.length <= 3,
      `the SDK witness has ${observed.length} descendant paths`,
    );
  }
  verifyDescriptorSearchContext(input.sdk, root, projects["7.0"], cache, env);
  return projects;
}

function verifyDescriptorSearchContext(
  sdk: string,
  root: string,
  project: string,
  cache: string,
  env: NodeJS.ProcessEnv,
): void {
  const plugin = path.join(root, "plugin");
  const name = "ttsc-descriptor-context-probe";
  const descriptor = path.join(plugin, "search-context.cjs");
  const observations = path.join(root, "observations");
  const evaluations = path.join(observations, "descriptor-evaluations.log");
  const parentSearch = path.join(root, "parent-search");
  const childSearch = path.join(root, "evaluator-search");
  const selected = path.join(childSearch, name, "index.js");
  const nearer = path.join(plugin, "node_modules", name, "index.js");
  // Keep the invocation counter outside the resolver's ancestor walks. A
  // creation beside a negative node_modules lookup changes its witness.
  fs.mkdirSync(observations);
  fs.writeFileSync(evaluations, "");
  fs.mkdirSync(parentSearch);
  fs.mkdirSync(path.dirname(selected), { recursive: true });
  fs.writeFileSync(selected, 'module.exports = "evaluator-context";\n');
  fs.writeFileSync(
    descriptor,
    [
      'const fs = require("node:fs");',
      'const path = require("node:path");',
      `const name = require(${JSON.stringify(name)});`,
      "module.exports = () => {",
      `  fs.appendFileSync(${JSON.stringify(evaluations)}, name + "\\n");`,
      '  return { name, source: path.join(__dirname, "go"), stage: "check", hostInputHashes: {} };',
      "};",
    ].join("\n"),
  );
  const actor = [
    'const assert = require("node:assert/strict");',
    'const fs = require("node:fs");',
    'const path = require("node:path");',
    "const [loader, project, cache, descriptor, selected, nearer, evaluations, parentSearch, childSearch] = process.argv.slice(1);",
    "const { loadProjectPlugins } = require(loader);",
    "const load = () => loadProjectPlugins({",
    '  binary: "", cwd: project, cacheDir: cache, file: "tsconfig.json",',
    "  env: { ...process.env, NODE_PATH: childSearch }, entries: [{ transform: descriptor }],",
    "});",
    "const first = load();",
    'assert.equal(first.nativePlugins[0].name, "evaluator-context");',
    'assert.equal(typeof first.hostInputHashes[selected], "string");',
    "assert.equal(first.hostInputHashes[nearer], null);",
    "assert.equal(first.hostInputRealpaths[nearer], null);",
    "assert.ok(!first.hostInputs.some(file => file.startsWith(parentSearch + path.sep)));",
    "assert.deepEqual(first.hostInputs.filter(file => !first.deferredHostInputs.includes(file) && (!Object.hasOwn(first.hostInputHashes, file) || !Object.hasOwn(first.hostInputRealpaths, file))), []);",
    'assert.equal(load().nativePlugins[0].name, "evaluator-context");',
    'assert.equal(fs.readFileSync(evaluations, "utf8"), "evaluator-context\\n");',
    "fs.mkdirSync(path.dirname(nearer), { recursive: true });",
    "fs.writeFileSync(nearer, 'module.exports = \"nearer-context\";\\n');",
    'assert.equal(load().nativePlugins[0].name, "nearer-context");',
    'assert.equal(fs.readFileSync(evaluations, "utf8"), "evaluator-context\\nnearer-context\\n");',
  ].join("\n");
  const result = childProcess.spawnSync(
    process.execPath,
    [
      "-e",
      actor,
      path.join(
        sdk,
        "lib",
        "plugin",
        "internal",
        "load",
        "loadProjectPlugins.js",
      ),
      project,
      cache,
      descriptor,
      selected,
      nearer,
      evaluations,
      parentSearch,
      childSearch,
    ],
    {
      cwd: project,
      encoding: "utf8",
      env: { ...env, NODE_PATH: parentSearch },
    },
  );
  assert.equal(result.status, 0, result.error?.message ?? result.stderr);
}
