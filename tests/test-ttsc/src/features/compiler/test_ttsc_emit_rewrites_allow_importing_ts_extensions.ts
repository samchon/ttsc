import {
  assert,
  commonJsProject,
  fs,
  path,
  runNode,
  spawn,
  ttscBin,
} from "../../internal/compiler-corpus";

/**
 * Verifies ttsc emit rewrites allowImportingTsExtensions imports.
 *
 * Forcing emit on a config that allows `.ts` import specifiers must add the
 * matching TypeScript-Go rewrite flag. Without it, the forced `--noEmit false`
 * profile turns an otherwise valid check-only config into TS5096.
 *
 * 1. Create a CommonJS project importing a helper with a `.ts` specifier.
 * 2. Run `ttsc --emit`.
 * 3. Assert the emitted JavaScript runs and points at the rewritten `.js` file.
 */
export const test_ttsc_emit_rewrites_allow_importing_ts_extensions = () => {
  const root = commonJsProject(
    {
      "src/helper.ts": `export const message: string = "ttsc-emit-extension-ok";\n`,
      "src/main.ts": `import { message } from "./helper.ts";\nconsole.log(message);\n`,
    },
    {
      compilerOptions: {
        allowImportingTsExtensions: true,
      },
    },
  );

  const result = spawn(ttscBin, ["--cwd", root, "--emit"], { cwd: root });
  assert.equal(result.status, 0, result.stderr);

  const js = fs.readFileSync(path.join(root, "dist", "main.js"), "utf8");
  assert.match(js, /helper\.js/);

  const run = runNode(path.join(root, "dist", "main.js"), { cwd: root });
  assert.equal(run.status, 0, run.stderr);
  assert.equal(run.stdout.trim(), "ttsc-emit-extension-ok");
};
