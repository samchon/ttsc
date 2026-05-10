import {
  assert,
  copyProject,
  fs,
  goPath,
  os,
  path,
  spawn,
  ttscBin,
} from "../../internal/plugin-corpus";

/**
 * Verifies plugin corpus: source plugin rejects ttsc-managed replacements.
 *
 * This ttsc plugin corpus scenario is isolated as one exported TypeScript feature
 * so failures identify the exact package contract under test without a
 * shared smoke wrapper or package-level switch statement.
 *
 * 1. Materialize a source plugin that imports ttsc utility code and also owns a
 *    local replacement for the same printer shim module path.
 * 2. Execute the real ttsc source-plugin build path.
 * 3. Assert ttsc rejects the plugin before Go reports an opaque workspace
 *    conflict or lets plugin-local code override host-managed shim modules.
 */
export const test_plugin_corpus_source_plugin_rejects_ttsc_managed_replacements =
  () => {
    const root = copyProject("go-source-plugin-managed-replace");
    const cacheDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "ttsc-source-plugin-managed-replace-"),
    );
    const result = spawn(ttscBin, ["--cwd", root, "--emit"], {
      cwd: root,
      env: {
        PATH: goPath(),
        TTSC_CACHE_DIR: cacheDir,
      },
    });
    assert.notEqual(result.status, 0, result.stderr);
    assert.match(
      result.stderr,
      /building source plugin "go-source-plugin-managed-replace"/,
    );
    assert.match(
      result.stderr,
      /go\.mod replaces ttsc-managed module "github\.com\/microsoft\/typescript-go\/shim\/printer"/,
    );
  };
