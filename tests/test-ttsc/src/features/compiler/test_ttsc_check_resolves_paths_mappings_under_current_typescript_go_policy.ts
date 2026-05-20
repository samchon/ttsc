import {
  assert,
  createProject,
  spawn,
  ttscBin,
} from "../../internal/toolchain";

/**
 * Verifies ttsc check resolves `paths` mappings under current TypeScript-Go
 * policy.
 *
 * The Go compiler tracks TypeScript-Go's evolving `paths` resolution policy.
 * Both wildcard (`@lib/*`) and exact-match (`exact-lib`) aliases must resolve
 * during the check phase. This test is intentionally written as a clean-pass
 * assertion so CI will catch any regression where the Go backend silently stops
 * resolving `paths` aliases in a newer tsgo version.
 *
 * 1. Create a project with `paths` aliases and source files that import via those
 *    aliases.
 * 2. Run `ttsc check`.
 * 3. Assert exit 0 (no type errors from unresolved paths).
 */
export const test_ttsc_check_resolves_paths_mappings_under_current_typescript_go_policy =
  () => {
    const root = createProject({
      "tsconfig.json": JSON.stringify({
        compilerOptions: {
          target: "ES2022",
          module: "ES2022",
          moduleResolution: "bundler",
          strict: true,
          paths: {
            "@lib/*": ["./lib/*"],
            "exact-lib": ["./lib/exact.ts"],
          },
        },
        include: ["src", "lib"],
      }),
      "lib/exact.ts": `export const exact = "exact" as const;\n`,
      "lib/tool.ts": `export const tool = "tool" as const;\n`,
      "src/main.ts": `
      import { exact } from "exact-lib";
      import { tool } from "@lib/tool";
      export const joined: string = exact + ":" + tool;
    `,
    });

    const result = spawn(ttscBin, ["check", "--cwd", root], { cwd: root });
    assert.equal(result.status, 0, result.stderr);
  };
