import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { resolveNativeSource } from "../../../../../packages/ttsc/src/plugin/internal/load/resolveNativeSource";
import { GoToolResolution } from "../../../../../packages/ttsc/src/plugin/internal/source/GoToolResolution";
import { resolveGoCompiler } from "../../../../../packages/ttsc/src/plugin/internal/source/resolveGoCompiler";
import { NativeSourcePackages } from "../../../../../packages/ttsc/src/plugin/internal/source/NativeSourcePackages";
import { TestProject } from "../../../../utils/src/TestProject";

/**
 * Verifies native ownership follows Go's effective build context and errors.
 *
 * Excluded main files previously claimed executable ownership. A linked
 * source-only package must instead be selected inside its host module, whose
 * generated workspace also excludes unrelated ancestor workspaces.
 *
 * 1. Observe a complete baseline population together, including invalid Go
 *    packages and ignored-file controls.
 * 2. Change tags, target OS/architecture, cgo and GOENV between observations.
 * 3. Observe source-only admission without activating an unavailable outer
 *    module, preserved relative overlays, and opposing candidate/host wrapper
 *    selections with ordinary equal-context controls.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls actual source/module resolution, batched Go metadata and ownership admission; compares literal main/library outcomes, preserves Go mixed-package/build-constraint errors and rejects test-only packages. Changed effective contexts and a selected-host source-only package are independently asserted.
 * @evidence contracts/testing.md#independent-expectations Authored static package declarations, Go build constraints, platform filename suffixes and production-file presence determine expected results; no second classifier calculates the oracle. The impossible outer module version and missing ancestor workspace are explicit negative controls.
 * @evidence contracts/testing.md#distinguishing-cases Owns excluded/selected tags, switched library/main, foreign/selected OS and architecture, ignored underscore/dot names, explicit cgo constraint versus unguarded cgo mixed error, valid external test versus invalid main test, no eligible/test-only/mixed packages, nested entry, direct go.mod, GOENV-selected tags, source-relative overlays and missing-host overlay refusal, plus both opposing real forwarding-wrapper contexts and equal-context controls. These wrappers forward to unchanged Go and alter supported tags; they do not simulate release-toolchain differences. Cross-target observations concern compiler selection metadata only.
 * @evidence contracts/testing.md#execution-ownership The named source-unit invokes actual Go list/mod edit/work use through the source owners with copied package-owned fixtures; it prepares no native compiler, plugin binary or host session. Maintained linked pipeline and explicit-host effects remain in the shared unplugin E2E producer.
 */
export function test_native_source_classification_uses_go_build_context(): void {
  const root = TestProject.physicalPath(TestProject.tmpdir("native-go-context-"));
  TestProject.copyDirectory(path.join(TestProject.WORKSPACE_ROOT,
    "packages/ttsc/test/fixtures/unit/native_source_classification_uses_go_build_context/inputs-1"), root);
  const rename = (directory: string): void => {
    for (const input of fs.readdirSync(directory, { withFileTypes: true })) {
      const file = path.join(directory, input.name);
      if (input.isDirectory()) rename(file);
      else if (input.name.endsWith(".go.txt")) fs.renameSync(file, file.slice(0, -4));
    }
  };
  rename(root);
  fs.renameSync(path.join(root, "go.work.txt"), path.join(root, "go.work"));
  const env = { ...process.env, GOOS: "windows", GOARCH: "amd64",
    CGO_ENABLED: "0", GOFLAGS: "", GOENV: "off", GOTOOLCHAIN: "local",
    GOPROXY: "off", GOSUMDB: "off" };
  const ids = ["plain-library", "plain-main", "excluded-tag", "switched",
    "foreign-os", "foreign-arch", "ignored-prefix", "cgo-constraint",
    "cgo-unguarded", "external-test", "invalid-test", "no-eligible",
    "test-only", "mixed", "nested/entry"];
  const observations = NativeSourcePackages.ownPackages(
    ids.map((id) => ({ source: path.join(root, id), label: id })), env,
  );
  const failures: unknown[] = [];
  ids.forEach((id, index) => {
    try {
      const source = path.join(root, id);
      const classify = () => resolveNativeSource(source, { source, name: id },
        { transform: id }, index, { env, observation: observations[index]! });
      if (["cgo-unguarded", "invalid-test", "mixed"].includes(id))
        assert.throws(classify, /found packages/);
      else if (id === "no-eligible") assert.throws(classify, /build constraints exclude all Go files/);
      else if (id === "test-only") assert.throws(classify, /no Go-selected production files/);
      else assert.deepEqual(classify(), {
        kind: id === "plain-main" ? "executable" : "linked", moduleRoot: root,
      });
    } catch (error) { failures.push(error); }
  });
  const observe = (id: string, changed: NodeJS.ProcessEnv = {}) => {
    const source = path.join(root, id);
    return resolveNativeSource(source, { source, name: id }, { transform: id }, 0,
      { env: { ...env, ...changed } });
  };
  const cases: Array<() => void> = [
    () => assert.equal(observe("go.mod").kind, "executable"),
    () => assert.equal(observe("source-only/package", { GOTOOLCHAIN: "path" }).kind, "linked"),
    () => assert.throws(() => NativeSourcePackages.ownPackages([
      { source: path.join(root, "source-only/package"), label: "own-module-error" },
    ], { ...env, GOTOOLCHAIN: "path" }), /requires go|Go version|toolchain/),
    () => assert.throws(() => observe("excluded-tag", { GOFLAGS: "-tags=ttsc_selected" }), /found packages/),
    () => assert.equal(observe("switched", { GOFLAGS: "-tags=ttsc_selected" }).kind, "executable"),
    () => assert.equal(observe("switched").kind, "linked"),
    () => assert.throws(() => observe("foreign-os", { GOOS: "linux" }), /found packages/),
    () => assert.throws(() => observe("foreign-arch", { GOARCH: "arm64" }), /found packages/),
    () => assert.throws(() => observe("cgo-constraint", { CGO_ENABLED: "1" }), /found packages/),
    () => assert.throws(() => observe("cgo-unguarded", { CGO_ENABLED: "1" }), /found packages/),
    () => {
      const goenv = path.join(root, "go.env.txt");
      const selected = { ...env, GOENV: goenv };
      delete (selected as NodeJS.ProcessEnv).GOFLAGS;
      const source = path.join(root, "switched");
      assert.equal(resolveNativeSource(source, { source, name: "goenv" },
        { transform: "goenv" }, 0, { env: selected }).kind, "executable");
    },
    () => {
      const source = path.join(root, "overlay/package");
      const changed = { ...env, GOFLAGS: "-overlay=relative.json" };
      const proposal = NativeSourcePackages.propose([{ source, label: "overlay" }], changed)[0]!;
      assert.equal(proposal.ownModule, false);
      assert.equal(NativeSourcePackages.kind(proposal.observation, "overlay"), "executable");
      assert.equal(NativeSourcePackages.kind(NativeSourcePackages.ownPackages([
        { source, label: "overlay-own" },
      ], changed)[0]!, "overlay-own", "executable"), "executable");
      assert.equal(resolveNativeSource(source, { source, name: "overlay" },
        { transform: "overlay" }, 0, { env: changed }).kind, "executable");
      assert.equal(NativeSourcePackages.kind(NativeSourcePackages.propose([
        { source, label: "no-overlay" },
      ], env)[0]!.observation, "no-overlay"), "linked");
      assert.throws(() => NativeSourcePackages.inspect({ source: root, pluginName: "missing-overlay", env: changed,
        packages: [{ entry: "./contrib/overlay", source, name: "overlay" }],
      }), /reading overlay|relative.json/);
    },
    () => {
      const compiler = resolveGoCompiler(env);
      const actualGo = GoToolResolution.resolveGoToolForBuild(compiler.binary, env, root);
      const wrapper = process.platform === "win32" ? "go-selected.cmd" : "go-selected.sh";
      if (process.platform !== "win32") {
        fs.chmodSync(path.join(root, "wrapper-source", wrapper), 0o755);
        fs.chmodSync(path.join(root, "wrapper-host", wrapper), 0o755);
      }
      const selected = { ...env, TTSC_GO_BINARY: `./${wrapper}`, TTSC_PROBE_REAL_GO: actualGo };
      const names = ["own-main", "host-main", "plain-main", "plain-library"];
      const candidates = names.map((label) => ({ source: path.join(root, "wrapper-source", label), label }));
      const proposals = NativeSourcePackages.propose(candidates, selected);
      const own = NativeSourcePackages.ownPackages(candidates, selected);
      const hosted = NativeSourcePackages.inspect({ source: path.join(root, "wrapper-host"), pluginName: "selected-host", env: selected,
        packages: candidates.map((candidate) => ({ ...candidate, name: candidate.label, entry: `./contrib/${candidate.label}` })),
      });
      const expectedOwn = ["executable", "linked", "executable", "linked"];
      const expectedHost = ["linked", "executable", "executable", "linked"];
      assert.throws(() => NativeSourcePackages.kind(hosted[1]!, "host-main", "linked"), /ownership disagrees.*selected executable, expected linked/);
      assert.equal(NativeSourcePackages.kind(own[0]!, "own-main", "executable"), "executable");
      for (let index = 0; index < names.length; index += 1) {
        assert.equal(NativeSourcePackages.kind(proposals[index]!.observation, names[index]!), expectedOwn[index]);
        assert.equal(NativeSourcePackages.kind(own[index]!, names[index]!), expectedOwn[index]);
        assert.equal(NativeSourcePackages.kind(hosted[index]!, names[index]!), expectedHost[index]);
      }
    },
    () => {
      const packages = NativeSourcePackages.inspect({ source: root, pluginName: "source-only", env,
        packages: [{ entry: "./contrib/linked", source: path.join(root, "source-only/package"), name: "linked" }],
      });
      assert.equal(NativeSourcePackages.kind(packages[0]!, "source-only"), "linked");
    },
  ];
  for (const check of cases) try { check(); } catch (error) { failures.push(error); }
  if (failures.length !== 0) throw new AggregateError(failures, "Go-context classification population");
}
