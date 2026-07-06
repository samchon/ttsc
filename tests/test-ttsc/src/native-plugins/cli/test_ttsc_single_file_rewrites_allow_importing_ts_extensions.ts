import {
  assert,
  commonJsProject,
  fs,
  path,
  spawn,
  ttscBin,
} from "../../internal/compiler-corpus";

/**
 * Verifies single-file emit rewrites allowImportingTsExtensions imports.
 *
 * Single-file compatibility mode also funnels through forced project emit, so
 * it must receive the same rewrite flag as `ttsc --emit`. The single-file path
 * materializes only the requested entry, so this pins the transformed source
 * contract rather than executing the dependency graph.
 *
 * 1. Create a CommonJS project importing a helper with a `.ts` specifier.
 * 2. Run `ttsc src/main.ts`.
 * 3. Assert the emitted JavaScript points at the rewritten `.js` file.
 */
export const test_ttsc_single_file_rewrites_allow_importing_ts_extensions =
  () => {
    const root = commonJsProject(
      {
        "src/helper.ts": `export const message: string = "single-file-extension-ok";\n`,
        "src/main.ts": `import { message } from "./helper.ts";\nconsole.log(message);\n`,
      },
      {
        compilerOptions: {
          allowImportingTsExtensions: true,
        },
      },
    );

    const result = spawn(ttscBin, ["--cwd", root, "src/main.ts"], {
      cwd: root,
    });
    assert.equal(result.status, 0, result.stderr);

    const jsPath = path.join(root, "dist", "main.js");
    const js = fs.readFileSync(jsPath, "utf8");
    assert.match(js, /helper\.js/);
  };
