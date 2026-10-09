import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import { SidecarEnvironment } from "../../../../../packages/ttsc/src/compiler/internal/sharedHost/SidecarEnvironment";
import { TestProject } from "../../../../utils/src/TestProject";

/**
 * Verifies temporary children fence ancestor Git discovery without taking over
 * explicit repository selectors or changing a fixture's own repository.
 *
 * 1. Observe checkout discovery from a standalone ignored fixture, then fence it.
 * 2. Preserve raw caller ceilings, empty entries and repeated-call identity.
 * 3. Discover an owned subrepository, a foreign cwd's own repository and an
 *    explicitly selected repository through the same configured environment.
 *
 * @evidence contracts/testing.md#behavioral-verification Real Git subprocesses contrast ancestor checkout discovery with fenced nonrepository status, then discover a real owned subrepository and the checkout at its own cwd. Explicit Git selectors still select the owned repository. Every subprocess must settle without an error or signal before its result is read.
 * @evidence contracts/testing.md#independent-expectations The checkout and an authored git-init control independently define repository identities. The standalone child has no .git, so its initial checkout discovery must stop at its configured physical parent. Literal caller list strings and environment snapshots define preservation and idempotence expectations.
 * @evidence contracts/testing.md#distinguishing-cases Absent, empty-sentinel, multi-entry and already-containing ceiling values cover native delimiters and repeated calls. A native backslash entry after a sentinel cannot substitute for Git's effective forward-separator entry on Windows; POSIX literal backslash directory names remain intact. Mixed-case names and conflicting aliases distinguish Windows native-name selection from POSIX exact spelling. Explicit GIT_DIR/GIT_WORK_TREE aliases retain their original keys and values and intentionally bypass implicit discovery fencing.
 * @evidence contracts/testing.md#execution-ownership The normal named unit invokes the actual common test allocator and synchronous Git processes. One ignored owned root contains all created directories and the git-init control; finally removes it only after those original children have joined. No product host, compiler build or ordinary E2E preparation runs.
 */
export function test_testproject_temporary_environment_isolates_implicit_git_discovery(): void {
  const root = TestProject.tmpdir(
    "ttsc-temporary-environment-git-",
    path.join(TestProject.WORKSPACE_ROOT, ".cache"),
  );
  try {
    const parent = fs.realpathSync.native(root);
    const gitParent = parent.split(path.sep).join("/");
    const standalone = path.join(parent, "standalone");
    const own = path.join(parent, "own");
    fs.mkdirSync(standalone);
    fs.mkdirSync(own);
    const inherited = { ...process.env };
    for (const name of [
      "GIT_DIR",
      "GIT_WORK_TREE",
      "GIT_CEILING_DIRECTORIES",
    ])
      SidecarEnvironment.write(inherited, name, undefined);
    const git = (cwd: string, env: NodeJS.ProcessEnv, ...args: string[]) => {
      const result = spawnSync("git", args, {
        cwd,
        env,
        encoding: "utf8",
        windowsHide: true,
      });
      assert.ifError(result.error);
      assert.equal(result.signal, null);
      return result;
    };
    const repository = (cwd: string, env: NodeJS.ProcessEnv): string => {
      const result = git(cwd, env, "rev-parse", "--show-toplevel");
      assert.equal(result.status, 0, result.stderr);
      return fs.realpathSync.native(result.stdout.trim());
    };
    const workspace = fs.realpathSync.native(TestProject.WORKSPACE_ROOT);
    assert.equal(repository(standalone, inherited), workspace);
    const configured = { ...inherited };
    TestProject.configureTemporaryEnvironment(configured, parent);
    assert.equal(
      git(standalone, configured, "rev-parse", "--show-toplevel").status,
      128,
    );
    assert.equal(repository(workspace, configured), workspace);
    const initialized = git(own, configured, "init", "--quiet");
    assert.equal(initialized.status, 0, initialized.stderr);
    assert.equal(repository(own, configured), fs.realpathSync.native(own));
    const nested = path.join(own, "nested");
    fs.mkdirSync(nested);
    assert.equal(repository(nested, configured), fs.realpathSync.native(own));

    const callerCeiling = path.join(parent, "caller-ceiling");
    const raw = [callerCeiling, path.join(parent, "second"), "", ""].join(
      path.delimiter,
    );
    for (const previous of [undefined, "", raw, raw + parent, raw + gitParent]) {
      const env: NodeJS.ProcessEnv = {
        ...inherited,
        TTSC_TEMPORARY_CONTROL: "unchanged",
        GIT_DIR: path.join(own, ".git"),
        GIT_WORK_TREE: own,
        git_dir: "lowercase selector remains caller-owned",
        git_work_tree: "lowercase tree remains caller-owned",
      };
      if (previous !== undefined) env.GIT_CEILING_DIRECTORIES = previous;
      TestProject.configureTemporaryEnvironment(env, parent);
      assert.deepEqual(env, {
        ...inherited,
        TEMP: parent,
        TMP: parent,
        TMPDIR: parent,
        TTSC_TEMPORARY_CONTROL: "unchanged",
        GIT_DIR: path.join(own, ".git"),
        GIT_WORK_TREE: own,
        git_dir: "lowercase selector remains caller-owned",
        git_work_tree: "lowercase tree remains caller-owned",
        GIT_CEILING_DIRECTORIES:
          previous === undefined
            ? gitParent
            : previous === raw + gitParent
              ? previous
              : previous + path.delimiter + gitParent,
      });
      const once = { ...env };
      TestProject.configureTemporaryEnvironment(env, parent);
      assert.deepEqual(env, once);
      assert.equal(repository(standalone, env), fs.realpathSync.native(own));
      const implicit = { ...env };
      SidecarEnvironment.write(implicit, "GIT_DIR", undefined);
      SidecarEnvironment.write(implicit, "GIT_WORK_TREE", undefined);
      assert.equal(
        git(standalone, implicit, "rev-parse", "--show-toplevel").status,
        128,
      );
    }

    for (const aliases of [
      { git_ceiling_directories: raw },
      { GIT_CEILING_DIRECTORIES: raw, git_ceiling_directories: "losing alias" },
    ]) {
      const env: NodeJS.ProcessEnv = { ...inherited, ...aliases };
      TestProject.configureTemporaryEnvironment(env, parent);
      assert.deepEqual(
        env,
        process.platform === "win32"
          ? {
              ...inherited,
              TEMP: parent,
              TMP: parent,
              TMPDIR: parent,
              GIT_CEILING_DIRECTORIES: raw + path.delimiter + gitParent,
            }
          : {
              ...inherited,
              ...aliases,
              TEMP: parent,
              TMP: parent,
              TMPDIR: parent,
              GIT_CEILING_DIRECTORIES:
                "GIT_CEILING_DIRECTORIES" in aliases
                  ? raw + path.delimiter + gitParent
                  : gitParent,
            },
      );
      const once = { ...env };
      TestProject.configureTemporaryEnvironment(env, parent);
      assert.deepEqual(env, once);
      assert.equal(
        git(standalone, env, "rev-parse", "--show-toplevel").status,
        128,
      );
    }
    const selectorAliases: NodeJS.ProcessEnv = {
      ...configured,
      git_dir: path.join(own, ".git"),
      git_work_tree: own,
    };
    const originalAliases = { ...selectorAliases };
    TestProject.configureTemporaryEnvironment(selectorAliases, parent);
    assert.deepEqual(selectorAliases, originalAliases);
    if (process.platform === "win32")
      assert.equal(
        repository(standalone, selectorAliases),
        fs.realpathSync.native(own),
      );
    else
      assert.equal(
        git(standalone, selectorAliases, "rev-parse", "--show-toplevel").status,
        128,
      );
    if (path.sep === "/") {
      const literal = path.join(parent, "literal\\backslash");
      const child = path.join(literal, "child");
      fs.mkdirSync(child, { recursive: true });
      const env = { ...inherited, GIT_CEILING_DIRECTORIES: "" };
      TestProject.configureTemporaryEnvironment(env, literal);
      assert.equal(env.GIT_CEILING_DIRECTORIES, path.delimiter + literal);
      assert.equal(
        git(child, env, "rev-parse", "--show-toplevel").status,
        128,
      );
    }
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}
