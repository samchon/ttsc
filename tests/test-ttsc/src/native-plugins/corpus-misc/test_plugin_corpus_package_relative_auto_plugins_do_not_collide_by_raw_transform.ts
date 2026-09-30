import { SHARED_PLUGIN_CACHE_DIR } from "../../internal/plugin-cache";
import {
  assert,
  commonJsProject,
  copyDirectory,
  fs,
  goPath,
  os,
  path,
  spawn,
  ttscBin,
  workspaceRoot,
  writeRelativePackagePlugin,
} from "../../internal/plugin-corpus";

/**
 * Verifies plugin corpus: package-relative auto plugins do not collide by raw
 * transform path.
 *
 * Auto-discovered plugins from multiple packages may each resolve to a
 * different absolute path even though their `transform` strings look similar.
 * The deduplication key must be the resolved package identity, not the raw
 * `transform` string, so two separate auto-plugin packages both run rather than
 * one silently shadowing the other.
 *
 * 1. Set up two fake packages (`plugin-a`, `plugin-b`) as symlinked node_modules
 *    entries; each contributes a different prefix/suffix operation.
 * 2. Run ttsc with `--emit` against the project that lists both as dependencies.
 * 3. Assert zero exit and the emitted JS contains `"A:plugin:B"`, confirming both
 *    plugins ran in order.
 *
 * @evidence contracts/testing.md#behavioral-verification Package-discovered prefix and suffix descriptors both reach native emit, yielding A:plugin:B and zero exit.
 * @evidence contracts/testing.md#independent-expectations The fixtures independently declare prefix A: and suffix :B around the literal plugin.
 * @evidence contracts/testing.md#distinguishing-cases Two packages use the same relative plugin.cjs spelling with distinct identities; missing either operation changes the asserted literal.
 * @evidence contracts/testing.md#execution-ownership The exported test_plugin_corpus_package_relative_auto_plugins_do_not_collide_by_raw_transform entry is discovered by TestExecutor from corpus-misc in the E2E runner population. Helper callbacks and embedded worker scripts execute beneath this named owner and are not separately selectable Evidence hosts.
 * @evidence contracts/e2e.md#necessary-boundary The CLI resolves two consumer packages with equal relative descriptor strings into separate factories, then passes both ordered options to the native transformer. A:plugin:B demonstrates their composed emit, which path-resolution units alone cannot prove.
 * @evidence contracts/e2e.md#shared-execution The suite reuses built workspace packages and the shared content-addressed producer cache when this case selects it. Separate launcher invocations carry this case's differing arguments or selected runtime entry; a case-local cold cache is retained when preparation or failure is asserted.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity TestProject owns the temporary consumer and cache roots until process exit. Authored descriptor/source mutations stay in that consumer; shared cached binaries are valid only for equivalent source, host and toolchain inputs. Child-specific environment options do not mutate ambient process state.
 * @evidence contracts/e2e.md#preserved-coverage Package-discovered prefix and suffix descriptors both reach native emit, yielding A:plugin:B and zero exit. These assertions stay in test_plugin_corpus_package_relative_auto_plugins_do_not_collide_by_raw_transform with their original fixture inputs and failure identity; no assertion has been transferred to a claimed but unexecuted semantic owner.
 */
export const test_plugin_corpus_package_relative_auto_plugins_do_not_collide_by_raw_transform =
  () => {
    const root = commonJsProject({
      "src/main.ts": `export const value: string = goUpper("plugin");\nconsole.log(value);\n`,
    });
    fs.writeFileSync(
      path.join(root, "package.json"),
      JSON.stringify({
        dependencies: {
          "plugin-a": "0.1.0",
          "plugin-b": "0.1.0",
        },
      }),
    );
    copyDirectory(
      path.join(workspaceRoot, "tests", "go-transformer"),
      path.join(root, "go-plugin"),
    );
    writeRelativePackagePlugin(root, "plugin-a", {
      name: "prefix",
      prefix: "A:",
    });
    writeRelativePackagePlugin(root, "plugin-b", {
      name: "suffix",
      suffix: ":B",
    });

    const result = spawn(ttscBin, ["--cwd", root, "--emit"], {
      cwd: root,
      env: {
        PATH: goPath(),
        TTSC_CACHE_DIR: SHARED_PLUGIN_CACHE_DIR,
      },
    });
    assert.equal(result.status, 0, result.stderr || result.stdout);
    const js = fs.readFileSync(path.join(root, "dist", "main.js"), "utf8");
    assert.match(js, /"A:plugin:B"/);
  };
