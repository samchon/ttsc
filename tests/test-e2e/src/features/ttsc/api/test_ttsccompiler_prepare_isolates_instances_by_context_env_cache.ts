import { TestProject } from "@ttsc/testing";

import {
  TtscCompiler,
  assert,
  createProject,
  expectArrayValue,
  fs,
  path,
  tsgo,
  writeSourcePlugin,
} from "../../../internal/ttsc/internal/compiler";

/**
 * Verifies two TtscCompiler instances isolate their source-plugin caches by
 * `context.env` alone, without mutating the shared `process.env`.
 *
 * Supplied `context.env` overrides are captured per instance; inherited
 * process environment remains an execution-time input. Two instances select isolated caches through
 * `context.env` while the source-plugin build reads that effective environment
 * (rather than the ambient `process.env`), so their artifacts never cross. This
 * is the multi-instance guarantee of RA-07: `prepare()` routes through the same
 * `loadProjectPlugins({ env })` seam that plugin-backed `compile`, `transform`,
 * and resident startup use. This case exercises prepare through that seam;
 * it does not execute the other consuming operations.
 *
 * Transformation direction with a negative twin: each instance pins a distinct
 * project-local `TTSC_CACHE_DIR` only in `context.env`, and the two builds land
 * their binaries under their own roots. If the build ignored `context.env` and
 * read the ambient environment, both instances would share one cache root and
 * their prepared binaries would collide.
 *
 * 1. Build the same source plugin through two instances whose `context.env` names
 *    different project-local cache roots.
 * 2. Snapshot `process.env.TTSC_CACHE_DIR` before and after.
 * 3. Assert each binary lives under its own cache root, the two paths differ, and
 *    the ambient `TTSC_CACHE_DIR` was never mutated.
 *
 * @evidence contracts/testing.md#behavioral-verification Prepares the same plugin through two compiler instances with .cache/a and .cache/b environments, requiring distinct existing binaries in their own roots and unchanged ambient TTSC_CACHE_DIR.
 * @evidence contracts/testing.md#independent-expectations Instance environment overrides determine each cache independently; the expected roots are authored literals, and the before/after ambient comparison detects global environment leakage.
 * @evidence contracts/testing.md#distinguishing-cases Two instances with identical sources but different cache roots distinguish artifact reuse ownership from accidental process.env mutation or cross-root placement.
 * @evidence contracts/testing.md#execution-ownership The named feature uses checkout built TtscCompiler through the shared subclass; each supplied TTSC_CACHE_DIR overrides its default cache injection. Both prepare calls return existing selected paths, not an independent loaded-image or new-build provenance proof.
 * @evidence contracts/e2e.md#necessary-boundary Real artifact placement through per-instance environment must remain isolated even when source identities match; pure key calculations cannot prove filesystem placement or ambient preservation.
 * @evidence contracts/e2e.md#shared-execution Both original prepare calls deliberately contrast private cache roots and retain positive/negative placement checks. Consolidated execution borrows the preceding cache owners' verified unchanged source project instead of creating the same descriptor/module again; .cache/a and b must each be absent. Selected compiler/API are shared but native builds/process totals and Program reuse are not inferred.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Standalone keeps its fresh physical project. Borrowed execution requires absent a/b namespaces, unchanged source inputs verified after previous prepare/clean, exact descriptor bytes and module membership. Supplied context.env differs without ambient mutation; overrides are snapshots, inherited env/omitted cwd execution-time inputs. Borrowed inputs/caches remain retained by the outer owner; direct returns do not certify arbitrary descendants or interruption cleanup.
 * @evidence contracts/e2e.md#preserved-coverage Both positive prefixes, distinct paths, binary existence, opposite-root negatives and ambient equality remain; no deletion or concurrent prepare is claimed.
 */
export const test_ttsccompiler_prepare_isolates_instances_by_context_env_cache =
  (preparedRoot?: string) => {
    const root = TestProject.physicalPath(
      preparedRoot ?? createProject({
        plugins: [{ transform: "./plugin.cjs" }],
      }),
    );
    if (preparedRoot === undefined)
      writeSourcePlugin(root);
    else {
      assert.equal(fs.existsSync(path.join(root, ".cache", "a")), false);
      assert.equal(fs.existsSync(path.join(root, ".cache", "b")), false);
      assert.deepEqual(fs.readdirSync(path.join(root, "plugin-go")).sort(), ["go.mod", "main.go"]);
      assert.equal(fs.readFileSync(path.join(root, "plugin.cjs"), "utf8"), 'module.exports = { name: "prepare-fixture", source: "./plugin-go" };\n');
    }
    const cacheRootA = path.join(root, ".cache", "a", "plugins");
    const cacheRootB = path.join(root, ".cache", "b", "plugins");

    const ambientBefore = process.env.TTSC_CACHE_DIR;

    const preparedA = new TtscCompiler({
      binary: tsgo,
      cwd: root,
      env: { TTSC_CACHE_DIR: ".cache/a" },
    }).prepare();
    const preparedB = new TtscCompiler({
      binary: tsgo,
      cwd: root,
      env: { TTSC_CACHE_DIR: ".cache/b" },
    }).prepare();

    const ambientAfter = process.env.TTSC_CACHE_DIR;
    const binaryA = expectArrayValue(preparedA, 0);
    const binaryB = expectArrayValue(preparedB, 0);

    assert.equal(binaryA.startsWith(cacheRootA + path.sep), true);
    assert.equal(binaryB.startsWith(cacheRootB + path.sep), true);
    assert.notEqual(binaryA, binaryB);
    assert.equal(fs.existsSync(binaryA), true);
    assert.equal(fs.existsSync(binaryB), true);
    // Neither instance's cache root may contain the other's binary.
    assert.equal(binaryA.startsWith(cacheRootB + path.sep), false);
    assert.equal(binaryB.startsWith(cacheRootA + path.sep), false);
    // Isolation came from context.env, not a mutated shared process.env.
    assert.equal(ambientAfter, ambientBefore);
  };
