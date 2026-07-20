import {
  assert,
  assertNoProjectAbove,
  createProject,
  fs,
  path,
  spawn,
  ttscBin,
} from "../../internal/toolchain";

/**
 * Verifies `ttsc --init` writes a starter tsconfig in a directory that has
 * none.
 *
 * `--init` exists to create the very file ttsc otherwise demands, yet the
 * launcher resolved a project before it ever looked at the forwarded flag, so
 * its only meaningful scenario failed with "could not find tsconfig.json or
 * jsconfig.json starting from …" and exit 2. `assertNoProjectAbove` guards the
 * fixture: an ancestor config would let `findUp` succeed, the throw would never
 * fire, and the case would pass while proving nothing.
 *
 * 1. Materialize a directory with no config and assert no ancestor carries one.
 * 2. Run `ttsc --init` there.
 * 3. Assert a zero exit and a `tsconfig.json` written into that directory.
 */
export const test_ttsc_init_writes_a_tsconfig_outside_a_project = () => {
  const root = createProject({ "src/main.ts": `export const value = 1;\n` });
  assertNoProjectAbove(root);

  const result = spawn(ttscBin, ["--cwd", root, "--init"], { cwd: root });
  assert.equal(result.status, 0, `${result.stdout}${result.stderr}`);
  assert.equal(
    fs.existsSync(path.join(root, "tsconfig.json")),
    true,
    `ttsc --init must create the tsconfig it otherwise demands:\n${result.stdout}${result.stderr}`,
  );
};
