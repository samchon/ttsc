import {
  assert,
  createProject,
  spawn,
  ttscBin,
} from "../../internal/toolchain";

/**
 * Verifies `ttsc cache paths` resolves every supported flag through the shared
 * schema identity.
 *
 * `cache paths` used to compare raw flag text even though the main launcher
 * normalizes every schema-owned spelling. A CI script with `--JSON`, `--Cwd`,
 * or `-P` therefore failed only on this subcommand. This drives the real
 * launcher so canonical and case-variant spellings reach the same cache path
 * calculation while the command keeps its strict value, command-scope, and
 * unknown-option boundaries.
 *
 * 1. Create a project and compare canonical cache options with case variants and
 *    `-P`.
 * 2. Assert that every supported spelling returns the same JSON path record.
 * 3. Assert `--json` values, non-cache schema flags, and unknown options still
 *    fail at the cache command boundary.
 */
export const test_ttsc_cache_paths_resolves_schema_flag_spellings = () => {
  const root = createProject({
    "src/main.ts": "export const value = 1;\n",
    "tsconfig.json": JSON.stringify({ include: ["src"] }),
  });
  const canonical = spawn(
    ttscBin,
    ["cache", "paths", "--json", "--cwd", root, "--cache-dir", ".cache"],
    { cwd: root },
  );
  assert.equal(canonical.status, 0, canonical.stderr);

  const caseVariants = spawn(
    ttscBin,
    ["cache", "paths", "--JSON", "--Cwd", root, "--CACHE-DIR", ".cache"],
    { cwd: root },
  );
  assert.equal(caseVariants.status, 0, caseVariants.stderr);
  assert.deepEqual(
    JSON.parse(caseVariants.stdout),
    JSON.parse(canonical.stdout),
  );

  const projectAlias = spawn(
    ttscBin,
    ["cache", "paths", "--JSON", "--CWD", root, "-P", "tsconfig.json"],
    { cwd: root },
  );
  assert.equal(projectAlias.status, 0, projectAlias.stderr);
  assert.equal(JSON.parse(projectAlias.stdout).projectRoot, root);

  const jsonValue = spawn(ttscBin, ["cache", "paths", "--json=true"], {
    cwd: root,
  });
  assert.notEqual(jsonValue.status, 0);
  assert.match(jsonValue.stderr, /--json does not take a value/);

  const spacedJsonValue = spawn(
    ttscBin,
    ["cache", "paths", "--json", "false"],
    { cwd: root },
  );
  assert.notEqual(spacedJsonValue.status, 0);
  assert.match(spacedJsonValue.stderr, /cache paths does not support "false"/);

  const unsupportedSchemaFlag = spawn(
    ttscBin,
    ["cache", "paths", "--binary", "tsgo"],
    { cwd: root },
  );
  assert.notEqual(unsupportedSchemaFlag.status, 0);
  assert.match(
    unsupportedSchemaFlag.stderr,
    /cache paths does not support "--binary"/,
  );

  const unknown = spawn(
    ttscBin,
    ["cache", "paths", "--not-a-real-cache-option"],
    { cwd: root },
  );
  assert.notEqual(unknown.status, 0);
  assert.match(
    unknown.stderr,
    /cache paths does not support "--not-a-real-cache-option"/,
  );
};
