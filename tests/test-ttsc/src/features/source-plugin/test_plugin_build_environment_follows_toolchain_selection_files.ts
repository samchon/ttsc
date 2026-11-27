import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import { SidecarEnvironment } from "../../../../../packages/ttsc/src/compiler/internal/sharedHost/SidecarEnvironment";
import { GoEnvironmentReading } from "../../../../../packages/ttsc/src/plugin/internal/source/GoEnvironmentReading";
import { GoToolResolution } from "../../../../../packages/ttsc/src/plugin/internal/source/GoToolResolution";
import { PluginBuildEnvironmentReadings } from "../../../../../packages/ttsc/src/plugin/internal/source/PluginBuildEnvironmentReadings";
import { PluginBuildEnvironmentWitness } from "../../../../../packages/ttsc/src/plugin/internal/source/PluginBuildEnvironmentWitness";
import { PluginContentIdentities } from "../../../../../packages/ttsc/src/plugin/internal/source/PluginContentIdentities";
import { pluginBuildEnvironment } from "../../../../../packages/ttsc/src/plugin/internal/source/pluginBuildEnvironment";
import { readPluginBuildEnvironment } from "../../../../../packages/ttsc/src/plugin/internal/source/readPluginBuildEnvironment";
import { TestProject } from "../../../../utils/src/TestProject";

/**
 * Verifies that Go's module and workspace toolchain selection invalidates a
 * build-environment answer, including a newly created ancestor workspace. A
 * path-only GOTOOLCHAIN confines the failing selection to the local host.
 *
 * 1. Record the usable toolchain in a child module and reread it unchanged.
 * 2. Add and remove an ancestor workspace that selects an unavailable version.
 * 3. Edit the module to select that version, then restore the working version.
 * 4. Exercise delegation across SDK roots, native launcher and capture paths on
 *    POSIX, and relative cache and worker requests across a cwd change.
 *
 * @evidence contracts/testing.md#behavioral-verification The direct answer reader over a real Go SDK and private store returns the working digest while selection holds, then produces a different digest and refuses the preceding witness whenever Go's selection files move.
 * @evidence contracts/testing.md#independent-expectations Go's toolchain selection rules give the ancestor workspace precedence and reject the authored higher requirement with path-only lookup. Restoring the original requirement restores the original build inputs.
 * @evidence contracts/testing.md#distinguishing-cases Covers absent, created, removed and edited selectors, native link retargeting and a dot-parent alias whose normalized spelling would select a different workspace, Go launcher and capture boundary. Relative cache and pending requests start under two bases, and editing just one workspace invalidates only that worker's reading. With a second SDK, an earlier PATH candidate displaces a different Go release in a shared SDK root.
 * @evidence contracts/testing.md#execution-ownership The unit runs native Go queries in temporary modules, through the real preparation worker and a bounded POSIX Node child with its own temp environment. It restores cwd without changing environment variables, copies already installed executables and runs no plugin build or installed ttsc host.
 */
export async function test_plugin_build_environment_follows_toolchain_selection_files(): Promise<void> {
  const root = TestProject.physicalPath(
    TestProject.tmpdir("ttsc-go-selection-"),
  );
  const module = path.join(root, "module");
  fs.mkdirSync(module);
  const env = SidecarEnvironment.merge(process.env, {
    GOENV: "off",
    GOTOOLCHAIN: "path",
    GOROOT: undefined,
    GOFLAGS: undefined,
    CGO_ENABLED: "0",
  });
  const sdk = spawnSync("go", ["env", "GOROOT"], {
    cwd: root,
    env: SidecarEnvironment.merge(env, { GOWORK: "off", GOTOOLCHAIN: "local" }),
    encoding: "utf8",
    windowsHide: true,
  });
  assert.equal(sdk.status, 0, sdk.stderr);
  const binary = path.join(
    sdk.stdout.trim(),
    "bin",
    process.platform === "win32" ? "go.exe" : "go",
  );
  const store = () =>
    PluginContentIdentities.open({
      projectRoot: root,
      cacheDir: path.join(root, "cache"),
      env,
    });
  const read = (directory = module) => {
    const witness: PluginBuildEnvironmentWitness.Record = new Map();
    const digest = readPluginBuildEnvironment(
      binary,
      directory,
      env,
      witness,
      store(),
    );
    return { witness, digest };
  };
  const manifest = path.join(module, "go.mod");
  const workspace = path.join(root, "go.work");
  const goodModule = "module example.com/module\n\ngo 1.23.0\n";
  fs.writeFileSync(manifest, goodModule);
  const previous = read();
  assert.equal(read().digest, previous.digest);
  assert.equal(PluginBuildEnvironmentWitness.holds(previous.witness), true);
  fs.writeFileSync(workspace, "go 1.99.0\n\nuse ./module\n");
  assert.equal(PluginBuildEnvironmentWitness.holds(previous.witness), false);
  const withWorkspace = read();
  assert.notEqual(withWorkspace.digest, previous.digest);
  fs.unlinkSync(workspace);
  assert.equal(
    PluginBuildEnvironmentWitness.holds(withWorkspace.witness),
    false,
  );
  assert.equal(read().digest, previous.digest);
  fs.writeFileSync(manifest, "module example.com/module\n\ngo 1.99.0\n");
  assert.equal(PluginBuildEnvironmentWitness.holds(previous.witness), false);
  assert.notEqual(read().digest, previous.digest);
  fs.writeFileSync(manifest, goodModule);
  assert.equal(read().digest, previous.digest);
  verifyDelegatedEnvironment({ binary, module, root, env, store: store() });
  const alias = path.join(root, "module-link");
  const replacement = path.join(root, "replacement");
  const linkKind = process.platform === "win32" ? "junction" : "dir";
  fs.mkdirSync(replacement);
  fs.writeFileSync(path.join(replacement, "go.mod"), goodModule);
  fs.symlinkSync(module, alias, linkKind);
  try {
    const linked = read(alias);
    fs.writeFileSync(path.join(module, "unrelated.txt"), "entry edit");
    assert.equal(PluginBuildEnvironmentWitness.holds(linked.witness), true);
    fs.unlinkSync(alias);
    fs.symlinkSync(replacement, alias, linkKind);
    assert.equal(PluginBuildEnvironmentWitness.holds(linked.witness), false);
  } finally {
    if (fs.lstatSync(alias, { throwIfNoEntry: false })?.isSymbolicLink())
      fs.unlinkSync(alias);
  }
  if (process.platform !== "win32")
    verifyNativeDotParentDirectory(binary, root, env, store());
  await verifyRelativeDirectoryRequests(root);
}

/** Use the same input spelling at two successive native working directories. */
async function verifyRelativeDirectoryRequests(root: string): Promise<void> {
  const first = path.join(root, "relative-a");
  const second = path.join(root, "relative-b");
  for (const base of [first, second]) {
    fs.mkdirSync(path.join(base, "module"), { recursive: true });
    fs.writeFileSync(
      path.join(base, "module", "go.mod"),
      "module example.com/module\n\ngo 1.23.0\n",
    );
  }
  const original = process.cwd();
  try {
    process.chdir(first);
    const initial = PluginBuildEnvironmentReadings.read("module", false, root);
    assert.equal(PluginBuildEnvironmentReadings.cached("module"), initial);
    process.chdir(second);
    assert.equal(PluginBuildEnvironmentReadings.cached("module"), undefined);
    assert.equal(
      PluginBuildEnvironmentReadings.cachedAll(["module"]).get("module"),
      undefined,
    );
    process.chdir(first);
    const requestA = PluginBuildEnvironmentReadings.prepare(
      "module",
      true,
      root,
    );
    process.chdir(second);
    const requestB = PluginBuildEnvironmentReadings.prepare(
      "module",
      true,
      root,
    );
    process.chdir(original);
    const [observedA, observedB] = await Promise.all([requestA, requestB]);
    process.chdir(first);
    assert.equal(PluginBuildEnvironmentReadings.cached("module"), observedA);
    fs.writeFileSync(path.join(first, "module", "go.work"), "go 1.23.0\n");
    assert.equal(PluginBuildEnvironmentReadings.cached("module"), undefined);
    process.chdir(second);
    assert.equal(
      PluginBuildEnvironmentReadings.cachedAll(["module"]).get("module"),
      observedB,
    );
  } finally {
    process.chdir(original);
  }
}

/** Compare cached reads against Go's native cwd selection across a path alias. */
function verifyNativeDotParentDirectory(
  binary: string,
  root: string,
  env: NodeJS.ProcessEnv,
  store: PluginContentIdentities.Store | undefined,
): void {
  const lexical = path.join(root, "lexical");
  const physical = path.join(root, "physical");
  const ordinary = path.join(lexical, "module");
  const child = path.join(physical, "child");
  fs.mkdirSync(ordinary, { recursive: true });
  fs.mkdirSync(child, { recursive: true });
  fs.mkdirSync(path.join(physical, "module"));
  fs.symlinkSync(child, path.join(lexical, "link"), "dir");
  const aliased = `${lexical}/link/../module`;
  const invalidWorkspace = path.join(physical, "go.work");
  fs.writeFileSync(invalidWorkspace, "go 1.99.0\n");
  const effective = SidecarEnvironment.merge(env, {
    GO111MODULE: "on",
    PWD: undefined,
    GOWORK: "auto",
  });
  const args = ["env", "-json", "GOROOT"];
  const native = (cwd: string) =>
    spawnSync(binary, args, { cwd, env: effective, encoding: "utf8" });
  assert.equal(native(ordinary).status, 0);
  const rejected = native(aliased);
  assert.equal(rejected.status, 1, rejected.stderr);
  assert.match(rejected.stderr, /go1\.99\.0/);
  const recorded = (cwd: string) =>
    GoEnvironmentReading.recorded(
      binary,
      cwd,
      effective,
      ["GOROOT"],
      undefined,
      store,
    );
  const digest = (cwd: string) =>
    readPluginBuildEnvironment(binary, cwd, effective, undefined, store);
  assert.ok(recorded(ordinary)?.GOROOT);
  const ordinaryDigest = digest(ordinary);
  assert.equal(recorded(aliased), undefined);
  assert.notEqual(digest(aliased), ordinaryDigest);
  fs.unlinkSync(invalidWorkspace);
  assert.ok(recorded(aliased)?.GOROOT);
  assert.equal(digest(aliased), ordinaryDigest);
  verifyDotParentLaunch(
    binary,
    ordinary,
    aliased,
    path.join(physical, "module"),
    effective,
    store,
  );
}

/** Check initial executable selection and the Go child's private temp root. */
function verifyDotParentLaunch(
  binary: string,
  lexical: string,
  cwd: string,
  physical: string,
  env: NodeJS.ProcessEnv,
  store: PluginContentIdentities.Store | undefined,
): void {
  const toolName = "dot-parent-go";
  const actual = path.join(physical, "bin", toolName);
  fs.mkdirSync(path.dirname(actual));
  fs.symlinkSync(binary, actual);
  fs.mkdirSync(path.join(lexical, "bin"));
  fs.symlinkSync(process.execPath, path.join(lexical, "bin", toolName));
  for (const requested of [`./bin/${toolName}`, toolName]) {
    const toolEnv = SidecarEnvironment.merge(env, {
      PATH: "bin",
      TTSC_GO_BINARY: requested,
    });
    assert.equal(
      GoToolResolution.resolveGoToolForBuild(requested, toolEnv, cwd),
      actual,
    );
    assert.equal(
      pluginBuildEnvironment(cwd, toolEnv, undefined, store),
      readPluginBuildEnvironment(actual, cwd, toolEnv, undefined, store),
    );
  }

  const temporary = path.join(physical, "inside-tmp");
  fs.mkdirSync(temporary);
  const loader = new URL(
    "../../../../../config/register-unit-loader.mjs",
    import.meta.url,
  );
  const spawnModule = new URL(
    "../../../../../packages/ttsc/src/plugin/internal/source/spawnGoTool.ts",
    import.meta.url,
  );
  const result = spawnSync(
    process.execPath,
    [
      "--import",
      loader.href,
      "--input-type=module",
      "--eval",
      `
      import { spawnGoTool } from ${JSON.stringify(spawnModule.href)};
      const result = spawnGoTool(${JSON.stringify(binary)}, ["env", "-json", "GOTMPDIR"], {
        cwd: ${JSON.stringify(cwd)}, encoding: "utf8"
      });
      if (result.status !== 0) throw result.error ?? new Error(result.stderr);
      process.stdout.write(result.stdout);
      `,
    ],
    {
      env: SidecarEnvironment.merge(env, {
        GOTOOLCHAIN: "local",
        TMPDIR: temporary,
        NODE_OPTIONS: undefined,
      }),
      encoding: "utf8",
      timeout: 30_000,
    },
  );
  assert.equal(result.status, 0, result.stderr);
  const captured: string = JSON.parse(result.stdout).GOTMPDIR;
  assert.ok(captured);
  assert.notEqual(path.dirname(captured), temporary);
  assert.deepEqual(fs.readdirSync(temporary), []);
}

/** Exercise real Go dispatch without downloading a test-only toolchain. */
function verifyDelegatedEnvironment(props: {
  binary: string;
  module: string;
  root: string;
  env: NodeJS.ProcessEnv;
  store: PluginContentIdentities.Store | undefined;
}): void {
  const { binary, module, root, env, store } = props;
  const launch = (
    args: readonly string[],
    runEnv: NodeJS.ProcessEnv,
    launcher = binary,
  ) => {
    const result = spawnSync(launcher, args, {
      cwd: module,
      env: runEnv,
      encoding: "utf8",
      windowsHide: true,
    });
    assert.equal(result.status, 0, result.stderr);
    return JSON.parse(result.stdout);
  };
  const local = launch(
    ["env", "-json", "GOVERSION", "GOMODCACHE", "GOOS", "GOARCH"],
    SidecarEnvironment.merge(env, { GOTOOLCHAIN: "local" }),
  );
  const registry = path.join(local.GOMODCACHE, "golang.org");
  const suffix = `.${local.GOOS}-${local.GOARCH}`;
  const prefix = "toolchain@v0.0.1-";
  const alternate = fs.existsSync(registry)
    ? fs
        .readdirSync(registry)
        .find(
          (name) =>
            name.startsWith(prefix) &&
            name.endsWith(suffix) &&
            name.slice(prefix.length, -suffix.length) !== local.GOVERSION &&
            fs.existsSync(
              path.join(registry, name, "bin", path.basename(binary)),
            ),
        )
    : undefined;
  if (alternate === undefined) {
    assert.notEqual(
      process.env.TTSC_TEST_REQUIRE_GO_DELEGATION,
      "1",
      "CI must prepare the comparison SDK",
    );
    process.stdout.write(
      "Go delegation control requires a second installed toolchain\n",
    );
    return;
  }
  const version = alternate.slice(prefix.length, -suffix.length);
  const executable = path.join(
    registry,
    alternate,
    "bin",
    path.basename(binary),
  );
  const early = path.join(root, "earlier-sdk");
  const late = path.join(root, "later-sdk");
  const defaults = (sdk: string, tags: string) =>
    fs.writeFileSync(path.join(sdk, "go.env"), `GOFLAGS=-tags=${tags}\n`);
  const install = (sdk: string) => {
    const candidate = path.join(sdk, "bin", version + path.extname(binary));
    fs.copyFileSync(executable, candidate);
    if (process.platform !== "win32") fs.chmodSync(candidate, 0o755);
  };
  for (const sdk of [early, late]) {
    for (const component of ["bin", "pkg/tool", "src/runtime"])
      fs.mkdirSync(path.join(sdk, component), { recursive: true });
  }
  defaults(early, "earlier");
  defaults(late, "later");
  install(late);
  const delegated = SidecarEnvironment.merge(env, {
    GOTOOLCHAIN: `${version}+path`,
    PATH: [early, late]
      .map((sdk) =>
        process.platform === "win32"
          ? `"${path.join(sdk, "bin")}"`
          : path.join(sdk, "bin"),
      )
      .join(path.delimiter),
    ...(process.platform === "win32" ? { PATHEXT: "EXE" } : {}),
  });
  const read = (tags: string, launcher = binary, root?: string) => {
    // Start the copied SDK before capturing its reusable metadata. Windows
    // can update the executable's change time on its first native load.
    const native = launch(
      ["env", "-json", "GOFLAGS", "GOROOT", "GOVERSION"],
      delegated,
      launcher,
    );
    const witness: PluginBuildEnvironmentWitness.Record = new Map();
    const actual = GoEnvironmentReading.recorded(
      launcher,
      module,
      delegated,
      ["GOFLAGS"],
      witness,
      store,
    );
    assert.equal(native.GOFLAGS, `-tags=${tags}`);
    assert.equal(native.GOVERSION, version);
    if (root !== undefined) assert.equal(native.GOROOT, root);
    assert.equal(actual?.GOFLAGS, native.GOFLAGS);
    assert.equal(actual?.GOROOT, native.GOROOT);
    assert.equal(PluginBuildEnvironmentWitness.reusable(witness), true);
    return witness;
  };
  const first = read("later");
  read("later");
  defaults(late, "later_edited");
  assert.equal(PluginBuildEnvironmentWitness.holds(first), false);
  const edited = read("later_edited");
  install(early);
  assert.equal(PluginBuildEnvironmentWitness.holds(edited), false);
  read("earlier");

  fs.unlinkSync(path.join(early, "bin", version + path.extname(binary)));
  const sharedLauncher = path.join(late, "bin", path.basename(binary));
  fs.copyFileSync(binary, sharedLauncher);
  if (process.platform !== "win32") fs.chmodSync(sharedLauncher, 0o755);
  fs.writeFileSync(path.join(late, "VERSION"), `${version}\n`);
  const shared = read("later_edited", sharedLauncher, late);
  install(early);
  assert.equal(PluginBuildEnvironmentWitness.holds(shared), false);
  read("earlier", sharedLauncher, early);
}
