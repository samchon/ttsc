import {
  assert,
  createProject,
  path,
  spawn,
  ttscBin,
} from "../../internal/toolchain";

/**
 * Verifies a malformed `tsconfig.json` is named on stderr and exits 2.
 *
 * This is the reported reproduction end to end: the launcher printed the raw V8
 * `JSON.parse` message, with no `ttsc:` prefix and no file name, telling the
 * user a byte offset in an unnamed file. The exit code was already right and
 * `compile.mdx` documents it, so the case pins both halves together — an
 * attributed message and the documented exit 2 — rather than only the reader's
 * throw, which the `features/project` cases cover.
 *
 * 1. Create a project whose `tsconfig.json` is left unterminated.
 * 2. Run `ttsc` against it.
 * 3. Assert exit 2 and a `ttsc:`-prefixed message naming that exact file.
 */
export const test_ttsc_names_the_malformed_tsconfig_and_exits_two = () => {
  const root = createProject({
    "tsconfig.json": `{ "compilerOptions": { "strict": true\n`,
    "src/main.ts": `export const value: number = 1;\n`,
  });

  const result = spawn(ttscBin, ["--cwd", root], { cwd: root });
  const output = `${result.stdout}${result.stderr}`;
  assert.equal(result.status, 2, output);
  assert.match(output, /ttsc: failed to parse /);
  assert.equal(
    output.includes(path.join(root, "tsconfig.json")),
    true,
    `the message must name the config that failed:\n${output}`,
  );
};
