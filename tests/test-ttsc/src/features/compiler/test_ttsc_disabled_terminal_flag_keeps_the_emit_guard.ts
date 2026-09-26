import fs from "node:fs";
import path from "node:path";

import {
  assert,
  createProject,
  spawn,
  ttscBin,
} from "../../internal/toolchain";

/**
 * Verifies `--showConfig false` keeps ttsc's emit guard around a failing build.
 *
 * TypeScript-Go reads `--showConfig false` as an ordinary compile. ttsc used to
 * classify the flag by presence alone, treat the build as a print-and-exit
 * command, and drop its `--noEmitOnError` guard, so a project with a type error
 * failed yet still wrote JavaScript. The effective value, not the spelling,
 * decides whether a terminal flag is in effect.
 *
 * 1. Create a project with a type error and no native plugins.
 * 2. Run `ttsc --showConfig false`, then `ttsc --showConfig false --showConfig
 *    true`.
 * 3. Assert the first fails without emitting, and the second prints the config
 *    because the last occurrence wins.
 */
export const test_ttsc_disabled_terminal_flag_keeps_the_emit_guard = () => {
  const root = createProject({
    "tsconfig.json": JSON.stringify({
      compilerOptions: {
        target: "ES2022",
        module: "commonjs",
        strict: true,
        outDir: "dist",
        rootDir: "src",
      },
      include: ["src"],
    }),
    "src/main.ts": `export const value: string = 1;\n`,
  });

  const disabled = spawn(
    ttscBin,
    ["--cwd", root, "--showConfig", "false"],
    { cwd: root },
  );
  assert.notEqual(disabled.status, 0, disabled.stdout);
  assert.match(disabled.stdout + disabled.stderr, /TS2322/);
  assert.equal(
    fs.existsSync(path.join(root, "dist", "main.js")),
    false,
    "a failed build with a disabled terminal flag must not emit",
  );

  const reenabled = spawn(
    ttscBin,
    ["--cwd", root, "--showConfig", "false", "--showConfig", "true"],
    { cwd: root },
  );
  assert.equal(reenabled.status, 0, reenabled.stderr);
  assert.match(reenabled.stdout, /"compilerOptions"/);
  assert.equal(fs.existsSync(path.join(root, "dist", "main.js")), false);
};
