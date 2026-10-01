import { TestProject } from "@ttsc/testing";

import {
  assert,
  copyProject,
  fs,
  goPath,
  os,
  path,
  spawn,
  ttscBin,
} from "../../../internal/plugin-corpus";

/**
 * Verifies plugin corpus: source path selects a sub-package.
 *
 * A plugin's entry point may live in a sub-package of the module (e.g.
 * `cmd/ttsc-go-transformer`). The build system must pass the sub-package path
 * to `go build` so the correct `main` is compiled; pointing at the module root
 * would build the wrong binary or fail if no root `main` exists.
 *
 * 1. Copy the `go-source-plugin-entry` fixture whose plugin points at a
 *    sub-package entry directory.
 * 2. Run ttsc with `--emit`.
 * 3. Assert zero exit, a build log referencing the plugin name, and `"ENTRY"` in
 *    the emitted JS (verifying the sub-package's `main` ran).
 *
 * @evidence contracts/testing.md#behavioral-verification ttsc --emit builds the named subpackage plugin and emits ENTRY with zero status.
 * @evidence contracts/testing.md#independent-expectations The fixture subpackage main defines the literal ENTRY rather than the default root transform.
 * @evidence contracts/testing.md#distinguishing-cases A source entry below the module root must select its main package; the direct go.mod source case owns module-file spelling.
 * @evidence contracts/testing.md#execution-ownership The exported test_plugin_corpus_source_path_selects_a_sub_package entry is discovered by TestExecutor from corpus-source in the E2E runner population. Helper callbacks and embedded worker scripts execute beneath this named owner and are not separately selectable Evidence hosts.
 * @evidence contracts/e2e.md#necessary-boundary The CLI selects a descriptor subpackage, invokes real Go against that entry and executes it to produce ENTRY in consumer emit. Module parsing alone cannot prove the selected main package reaches the native producer.
 * @evidence contracts/e2e.md#shared-execution A copied consumer/plugin fixture and private cold plugin cache retain this case's entry selection, build log or failure. The suite built compiler and Go toolchain are reused; the source mutation or forbidden replacement cannot reuse the canonical warm producer binary.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity TestProject owns the temporary consumer and cache roots until process exit. Authored descriptor/source mutations stay in that consumer; shared cached binaries are valid only for equivalent source, host and toolchain inputs. Child-specific environment options do not mutate ambient process state.
 * @evidence contracts/e2e.md#preserved-coverage ttsc --emit builds the named subpackage plugin and emits ENTRY with zero status. These assertions stay in test_plugin_corpus_source_path_selects_a_sub_package with their original fixture inputs and failure identity; no assertion has been transferred to a claimed but unexecuted semantic owner.
 */
export const test_plugin_corpus_source_path_selects_a_sub_package = () => {
  const root = copyProject("go-source-plugin-entry");
  const cacheDir = TestProject.tmpdir("ttsc-source-plugin-entry-");
  const result = spawn(ttscBin, ["--cwd", root, "--emit"], {
    cwd: root,
    env: { PATH: goPath(), TTSC_CACHE_DIR: cacheDir },
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(
    result.stderr,
    /building source plugin "go-source-plugin-entry"/,
  );
  assert.match(
    fs.readFileSync(path.join(root, "dist", "main.js"), "utf8"),
    /"ENTRY"/,
  );
};
