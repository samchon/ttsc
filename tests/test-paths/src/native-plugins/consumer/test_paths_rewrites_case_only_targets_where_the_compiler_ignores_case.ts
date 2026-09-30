import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { compilerUsesCaseSensitiveFileNames } from "ttsc/tsconfig";

import { TestPaths } from "../../internal/TestPaths";
import { SHARED_PLUGIN_CACHE_DIR } from "../../internal/plugin-cache";

/**
 * Verifies paths: where the compiler ignores case, aliases use the compiler
 * host's file identity.
 *
 * The plugin used case-preserving map keys after tsgo had already accepted a
 * case-only target, leaving the alias in emitted JavaScript. Source lookup must
 * canonicalize every exact, extension, and index candidate with the host rule.
 * A case-only target names a file only where the compiler looks names up
 * without case, as on Windows and on a case-insensitive macOS volume, so the
 * case runs there and nowhere else.
 *
 * 1. Create lowercase sources and uppercase exact and extensionless aliases.
 * 2. Compile the project through the real ttsc and paths plugin.
 * 3. Assert every alias becomes the relative emitted JavaScript path.
 *
 * @evidence contracts/testing.md#behavioral-verification On a case-insensitive compiler host all four case-only aliases must become exact, extensionless, explicit and directory-index runtime paths.
 * @evidence contracts/testing.md#independent-expectations Host file identity treats the authored uppercase targets as the existing lowercase sources only on eligible volumes.
 * @evidence contracts/testing.md#distinguishing-cases Exact, extensionless, explicit extension and index lookup remain distinct; case-sensitive hosts do not execute these unsupported positive inputs.
 * @evidence contracts/testing.md#execution-ownership This named test_paths_rewrites_case_only_targets_where_the_compiler_ignores_case entry runs through TestExecutor and the real built launcher or native host; portable decisions are separate Go units.
 * @evidence contracts/e2e.md#necessary-boundary Compiler filesystem identity must survive native plugin source lookup and emitted specifier publication.
 * @evidence contracts/e2e.md#shared-execution One eligible project batches the four lookup shapes; the case-sensitive skip is a stated execution limitation, not proof of this boundary on Linux. Other unchanged native preparations reuse TestProject.sharedPluginCache, whose identity covers compiler, SDK, sources and overlays.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity TestProject owns fresh fixture directories until process exit, including failure; synchronous child processes finish before assertions. Sources/config remain fixed for their compilation, and only unchanged artifact inputs share the cache, never consumer results.
 * @evidence contracts/e2e.md#preserved-coverage On a case-insensitive compiler host all four case-only aliases must become exact, extensionless, explicit and directory-index runtime paths. All original assertions remain in this named entry. TestLinkedProgramRewritesModuleSyntaxWithoutChangingOtherLiterals owns eligible syntax, adjacent ordinary literals and lexical require controls in the Go unit population; these emit assertions retain serializer and copied-output responsibility.
 */
export function test_paths_rewrites_case_only_targets_where_the_compiler_ignores_case() {
    const root = TestProject.createProject({
      "tsconfig.json": JSON.stringify({
        compilerOptions: {
          target: "ES2022",
          module: "CommonJS",
          forceConsistentCasingInFileNames: false,
          paths: {
            "@exact": ["./SRC/EXACT.ts"],
            "@extensionless": ["./SRC/EXTENSIONLESS"],
            "@explicit": ["./SRC/EXPLICIT.ts"],
            "@directory": ["./SRC/DIRECTORY"],
          },
          outDir: "dist",
          rootDir: "src",
          plugins: [{ transform: "@ttsc/paths" }],
        },
        include: ["src"],
      }),
      "src/exact.ts": `export const exact = "exact";\n`,
      "src/extensionless.ts": `export const extensionless = "extensionless";\n`,
      "src/explicit.ts": `export const explicit = "explicit";\n`,
      "src/directory/index.ts": `export const directory = "directory";\n`,
      "src/main.ts": [
        `import { exact } from "@exact";`,
        `import { extensionless } from "@extensionless";`,
        `import { explicit } from "@explicit";`,
        `import { directory } from "@directory";`,
        `export const value = exact + extensionless + explicit + directory;`,
        ``,
      ].join("\n"),
    });
    const env = {
      PATH: TestPaths.goPath(),
      TTSC_CACHE_DIR: SHARED_PLUGIN_CACHE_DIR,
    };
    if (
      compilerUsesCaseSensitiveFileNames({
        env: { ...process.env, ...env },
        projectRoot: root,
      })
    )
      return;
    TestPaths.seedPackage(root);

    const result = TestProject.spawn(
      TestProject.TTSC_BIN,
      ["--cwd", root, "--emit"],
      { cwd: root, env },
    );
    assert.equal(result.status, 0, result.stderr);

    const output = fs.readFileSync(path.join(root, "dist", "main.js"), "utf8");
    for (const alias of ["@exact", "@extensionless", "@explicit", "@directory"])
      assert.doesNotMatch(output, new RegExp(alias));
    assert.match(output, /require\("\.\/exact\.js"\)/i);
    assert.match(output, /require\("\.\/extensionless\.js"\)/i);
    assert.match(output, /require\("\.\/explicit\.js"\)/i);
    assert.match(output, /require\("\.\/directory\/index\.js"\)/i);
}
