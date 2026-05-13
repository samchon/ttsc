import {
  assert,
  createProject,
  spawn,
  ttscBin,
} from "../../internal/toolchain";

/**
 * Verifies ttsc check resolves paths mappings under current TypeScript-Go
 * policy.
 *
 * This ttsc compiler toolchain scenario is isolated as one exported TypeScript
 * feature so failures identify the exact package contract under test without a
 * shared smoke wrapper or package-level switch statement.
 *
 * 1. Materialize the project fixture or module graph required by the case.
 * 2. Execute the real ttsc, ttsx, lint, or unplugin path under test.
 * 3. Assert the observable output, diagnostics, or plugin descriptor shape.
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
