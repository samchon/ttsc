import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import child_process from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import { buildSourcePlugin } from "../../../../../../packages/ttsc/lib/plugin/internal/source/buildSourcePlugin.js";
import { copiesPluginSourceEntry } from "../../../../../../packages/ttsc/lib/plugin/internal/source/copiesPluginSourceEntry.js";
import { ensureExecutableGoToolchain } from "../../../../../../packages/ttsc/lib/plugin/internal/source/ensureExecutableGoToolchain.js";
import { resolveGoCompiler } from "../../../../../../packages/ttsc/lib/plugin/internal/source/resolveGoCompiler.js";
import { resolveSourceBuildCachePaths } from "../../../../../../packages/ttsc/lib/plugin/internal/source/resolveSourceBuildCachePaths.js";
import { isOrdinarilyClosedReadonlyLauncher } from "../../../../../utils/src/isOrdinarilyClosedReadonlyLauncher";
import { shellQuote } from "../../../internal/ttsc/internal/source-build";

/**
 * Verifies one actual source build publishes locally and reuses content
 * identity.
 *
 * One package-owned Go module and one installed Go toolchain replace the five
 * separate fake producers for copy, standard directories, default placement,
 * empty-boundary marking and cross-root reuse. The direct source copy unit owns
 * exact byte selection, while actual compilation also receives the worktree
 * file and backup-shaped directory through scratch materialization.
 *
 * 1. Copy the authored Go input and select its empty local installation boundary.
 * 2. Build once with actual Go, execute its empty-default branch and retain the
 *    same workspace cache root after its ownership marker is populated.
 * 3. Copy only source inputs to another root, select the same cache through
 *    TTSC_CACHE_DIR and require the same binary without another compiler
 *    invocation. Return that same observed executable to the sequential runtime
 *    consumer, whose call-local race authorities select its compiler delegate.
 *
 * @evidence contracts/testing.md#behavioral-verification Actual buildSourcePlugin publishes an executable below the literal workspace-local plugin cache, preserves the default root after marking and returns that identical executable for equivalent source at a second root. The actual Go forwarder independently requires literal vendor/lib/dist/build scratch paths, package rules bytes and worktree-file/backup-directory bytes before invoking Go, and its invocation log requires exactly one build before and after reuse; the published program executes with status zero and empty stdout.
 * @evidence contracts/testing.md#independent-expectations Without the three call-local orphan race authorities, the authored package-owned main returns without work, so successful execution has status zero and no stdout. Literal workspace paths define placement; actual forwarded argv records independently count the compiler invocation, while source equivalence follows copying through the separately byte-verified source filter.
 * @evidence contracts/testing.md#distinguishing-cases An outer dependency installation contrasts the nearer empty boundary; its cold source publication contrasts a second equivalent source root served without compilation. The source copy unit preserves vendor/lib/dist/build, worktree .git and notes~ distinctions plus excluded files, directories and links.
 * @evidence contracts/testing.md#execution-ownership This E2E entry invokes the actual installed Go metadata and compiler through a recording forwarder, then executes its actual published binary. No fake metadata or fake plugin binary is used. test_source_copy_preserves_entry_kinds_and_keyed_bytes owns portable copy/digest assertions without child processes.
 * @evidence contracts/e2e.md#necessary-boundary Actual module materialization, Go compilation, executable publication and cache reuse must agree across the source builder and native producer. Direct path and copy units cannot prove that the returned artifact is executable or that a warm request avoids Go build.
 * @evidence contracts/e2e.md#shared-execution Five former independent fake producer fixtures and five cold publications become one actual Go forwarder and one cold publication. The second source root is an equivalent-input consumer necessary for cross-root reuse, not another producer. The sequential CommonJS runtime owner calls this case once and receives its actual executable; the case is not independently discovered by the test_ directory runner. Metadata requests remain actual forwarded Go requests.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity One tracked container owns the module, forwarding script, log and managed caches. The first publication remains warm; source-only copying omits caches and avoids duplicating their ownership. Call-local environments select the tool and roots without changing process globals, and the synchronous smoke must return ordinary status/signal/PID metadata before literal result assertions. Any preparation failure withholds the owning container from exit cleanup, including failures before the borrower receives it; the returned root permits later unresolved runtime readers to retain that same owner. This receipt decision alone does not certify descendant closure.
 * @evidence contracts/e2e.md#preserved-coverage The former copy entry-kind assertions have executed in test_source_copy_preserves_entry_kinds_and_keyed_bytes with exact paths and bytes; conventional-directory materialization is also checked independently in the actual compiler scratch cwd by the Go forwarder. Default workspace placement, empty-boundary stability, publication success, identical cross-root binary identity and one-build reuse execute here through actual Go; the previous fake-binary text expectation is replaced by executing the authored actual program.
 */
export const case_buildsourceplugin_defaults_to_workspace_local_cache = (): {
  binary: string;
  root: string;
} => {
  const allocation = TestProject.tmpdir("ttsc-source-build-canonical-");
  try {
    const container = TestProject.physicalPath(allocation);
    const source = path.join(container, "project");
    const fixture = path.join(
      TestProject.WORKSPACE_ROOT,
      "packages",
      "ttsc",
      "test",
      "fixtures",
      "e2e",
      "plugin_source_state_holds_takes_a_digest_the_caller_vouches_for",
      "inputs-1",
    );
    fs.cpSync(fixture, source, {
      recursive: true,
      filter: (location) => copiesPluginSourceEntry(fixture, location),
    });
    for (const relative of [
      "vendor/local/value.go",
      "lib/helper.go",
      "dist/generated.go",
      "build/generated.go",
    ]) {
      const target = path.join(source, relative);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.copyFileSync(
        path.join(source, "internal", "rules", "rule.go"),
        target,
      );
    }
    fs.writeFileSync(
      path.join(source, ".git"),
      "gitdir: ../.git/worktrees/plugin\n",
    );
    fs.mkdirSync(path.join(source, "notes~"));
    fs.writeFileSync(path.join(source, "notes~", "notes.txt"), "kept notes\n");
    fs.mkdirSync(path.join(container, "node_modules", "dependency"), {
      recursive: true,
    });
    fs.mkdirSync(path.join(source, "node_modules"), { recursive: true });
    assert.deepEqual(fs.readdirSync(path.join(source, "node_modules")), []);
    const tools = path.join(container, "tools");
    fs.mkdirSync(tools);
    const script = path.join(tools, "actual-go.cjs");
    fs.copyFileSync(
      path.join(
        TestProject.WORKSPACE_ROOT,
        "tests",
        "test-e2e",
        "fixtures",
        "ttsc",
        "source-plugin",
        "actual-go.cjs",
      ),
      script,
    );
    const actualGo = resolveGoCompiler({ ...process.env, TTSC_GO_BINARY: "" });
    ensureExecutableGoToolchain(actualGo.binary, actualGo.bundled);
    const go = path.join(tools, process.platform === "win32" ? "go.cmd" : "go");
    fs.writeFileSync(
      go,
      process.platform === "win32"
        ? `@echo off\r\n"${process.execPath}" "%~dp0actual-go.cjs" %*\r\n`
        : `#!/bin/sh\nexec ${shellQuote(process.execPath)} ${shellQuote(script)} "$@"\n`,
    );
    if (process.platform !== "win32") fs.chmodSync(go, 0o755);
    const invocations = path.join(container, "go-invocations.jsonl");
    const env: NodeJS.ProcessEnv = {
      ...process.env,
      GOCACHE: "",
      TTSC_CACHE_DIR: "",
      TTSC_GO_CACHE_DIR: "",
      TTSC_GO_BINARY: go,
      TTSC_TEST_ACTUAL_GO: actualGo.binary,
      TTSC_TEST_GO_INVOCATIONS: invocations,
    };
    const expected = path.join(source, "node_modules", ".cache", "ttsc");
    assert.equal(
      resolveSourceBuildCachePaths(source, undefined, env).root,
      expected,
    );
    const request = (root: string, cacheDir?: string): string =>
      buildSourcePlugin({
        baseDir: root,
        env:
          cacheDir === undefined ? env : { ...env, TTSC_CACHE_DIR: cacheDir },
        overlayDirs: [],
        pluginName: "canonical-source",
        quiet: true,
        source: root,
        ttscVersion: "1.0.0",
        tsgoVersion: "7.0.0-dev",
      });
    const countBuilds = (): number =>
      fs
        .readFileSync(invocations, "utf8")
        .trim()
        .split(/\r?\n/)
        .map((line) => JSON.parse(line) as string[])
        .filter((args) => args[0] === "build").length;
    const first = request(source);
    assert.ok(
      first.startsWith(path.join(expected, "plugins") + path.sep),
      first,
    );
    assert.ok(fs.existsSync(first));
    assert.equal(
      countBuilds(),
      1,
      "the cold request must compile exactly once",
    );
    const execution = child_process.spawnSync(first, [], {
      encoding: "utf8",
      windowsHide: true,
      env: {
        ...process.env,
        ORPHAN_RACE_SOURCE: undefined,
        ORPHAN_RACE_DONE: undefined,
        ORPHAN_RACE_COMPILER: undefined,
      },
    });
    if (!isOrdinarilyClosedReadonlyLauncher(execution))
      throw new Error(
        "published smoke did not return ordinary status/signal/PID metadata",
        {
          cause:
            execution.error ??
            new Error(
              JSON.stringify({
                pid: execution.pid,
                status: execution.status,
                signal: execution.signal,
              }),
            ),
        },
      );
    if (execution.error) throw execution.error;
    assert.equal(execution.status, 0, execution.stderr);
    assert.equal(execution.stdout, "");
    assert.equal(
      resolveSourceBuildCachePaths(source, undefined, env).root,
      expected,
    );
    const secondSource = path.join(container, "relocated");
    fs.cpSync(source, secondSource, {
      recursive: true,
      filter: (location) => copiesPluginSourceEntry(source, location),
    });
    const second = request(secondSource, expected);
    assert.equal(
      second,
      first,
      "equivalent source roots must share the published content identity",
    );
    assert.equal(
      countBuilds(),
      1,
      "the relocated request must not compile again",
    );
    assert.deepEqual(fs.readFileSync(second), fs.readFileSync(first));
    return { binary: first, root: allocation };
  } catch (error) {
    // A failed preparation cannot hand its root to the sequential borrower.
    // Withhold this owner's cleanup rather than infer closure from a throw.
    try {
      TestProject.retainTemporaryDirectory(
        allocation,
        "canonical source publication failed before its ownership handoff",
      );
    } catch (retentionError) {
      throw new AggregateError(
        [error, retentionError],
        "canonical source publication failed and its root retention failed",
      );
    }
    throw error;
  }
};
