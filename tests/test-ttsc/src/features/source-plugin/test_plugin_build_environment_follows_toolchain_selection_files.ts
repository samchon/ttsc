import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import { SidecarEnvironment } from "../../../../../packages/ttsc/src/compiler/internal/sharedHost/SidecarEnvironment";
import { GoEnvironmentReading } from "../../../../../packages/ttsc/src/plugin/internal/source/GoEnvironmentReading";
import { PluginBuildEnvironmentWitness } from "../../../../../packages/ttsc/src/plugin/internal/source/PluginBuildEnvironmentWitness";
import { PluginContentIdentities } from "../../../../../packages/ttsc/src/plugin/internal/source/PluginContentIdentities";
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
 * 4. With another installed Go SDK, change its defaults and add a preceding
 *    executable for the same delegated version.
 * 5. Distinguish an unrelated directory-entry edit from replacing the directory
 *    selected through the Go working-directory alias.
 *
 * @evidence contracts/testing.md#behavioral-verification The direct answer reader over a real Go SDK and private store returns the working digest while selection holds, then produces a different digest and refuses the preceding witness whenever Go's selection files move.
 * @evidence contracts/testing.md#independent-expectations Go's toolchain selection rules give the ancestor workspace precedence and reject the authored higher requirement with path-only lookup. Restoring the original requirement restores the original build inputs.
 * @evidence contracts/testing.md#distinguishing-cases Covers absent, created, removed and edited selection files. A native link preserves working-directory authority across an unrelated sibling entry but loses it on retarget. Where a second cached SDK is installed, actual Go compares a stable delegation, edited SDK defaults and an earlier PATH candidate at the same version. The separate packaged identity unit owns shipped SDK metadata.
 * @evidence contracts/testing.md#execution-ownership The unit probes an installed Go tool directly using local-only selection. It owns the temporary module, workspace and answer store, and runs no plugin build or installed ttsc host.
 */
export function test_plugin_build_environment_follows_toolchain_selection_files(): void {
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
  const launch = (args: readonly string[], runEnv: NodeJS.ProcessEnv) => {
    const result = spawnSync(binary, args, {
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
  const read = (tags: string) => {
    // Start the copied SDK before capturing its reusable metadata. Windows
    // can update the executable's change time on its first native load.
    const native = launch(["env", "-json", "GOFLAGS", "GOROOT"], delegated);
    const witness: PluginBuildEnvironmentWitness.Record = new Map();
    const actual = GoEnvironmentReading.recorded(
      binary,
      module,
      delegated,
      ["GOFLAGS"],
      witness,
      store,
    );
    assert.equal(native.GOFLAGS, `-tags=${tags}`);
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
}
