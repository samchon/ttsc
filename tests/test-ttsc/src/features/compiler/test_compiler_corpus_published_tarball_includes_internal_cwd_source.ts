import {
  assert,
  child_process,
  path,
  workspaceRoot,
} from "../../internal/plugin-corpus";

interface NpmPackEntry {
  files?: { path?: unknown }[];
}

/**
 * Verifies compiler corpus: published tarball includes internal/cwd source.
 *
 * Locks `packages/ttsc/package.json#files` against orphan-source regressions.
 * The Go command package `cmd/ttsc/api_compile.go` and `api_transform.go` import
 * `github.com/samchon/ttsc/packages/ttsc/internal/cwd`. Without `internal`
 * in the published files array the consumer-side tarball cannot rebuild
 * the native compiler host because the import target is missing on disk.
 *
 * 1. Run `npm pack --dry-run --json` against packages/ttsc.
 * 2. Parse the JSON manifest and collect the file paths npm would publish.
 * 3. Assert `internal/cwd/cwd.go` is present.
 */
export const test_compiler_corpus_published_tarball_includes_internal_cwd_source =
  () => {
    const ttscPackageDir = path.join(workspaceRoot, "packages", "ttsc");
    const result = child_process.spawnSync(
      "npm",
      ["pack", "--dry-run", "--json"],
      {
        cwd: ttscPackageDir,
        encoding: "utf8",
        windowsHide: true,
        env: process.env,
      },
    );
    assert.equal(
      result.status,
      0,
      `npm pack --dry-run failed:\n${result.stderr}`,
    );

    const parsed = JSON.parse(result.stdout) as NpmPackEntry[];
    assert.ok(
      Array.isArray(parsed) && parsed.length > 0,
      `npm pack --dry-run returned no entries:\n${result.stdout}`,
    );

    const paths = (parsed[0]!.files ?? [])
      .map((file) => (typeof file?.path === "string" ? file.path : null))
      .filter((file): file is string => file !== null);
    assert.ok(
      paths.includes("internal/cwd/cwd.go"),
      `published tarball is missing internal/cwd/cwd.go. present files:\n${paths.join("\n")}`,
    );
  };
