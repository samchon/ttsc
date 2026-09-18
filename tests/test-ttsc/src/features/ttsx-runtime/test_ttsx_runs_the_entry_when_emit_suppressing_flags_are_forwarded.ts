import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";

/**
 * Verifies ttsx still runs the entry when a flag that suppresses JavaScript
 * output is forwarded to its type-check.
 *
 * Flags before the entry go to the type-check, and `--noEmit` or
 * `--emitDeclarationOnly` changes nothing about that check. The runtime build
 * is the same compiler pass, though, and the forwarded flag came after ttsx's
 * own `--noEmit false`, so the build wrote no JavaScript and the run ended with
 * `emitted entry not found`. The runtime build now switches both back off after
 * every forwarded flag.
 *
 * 1. Create a project whose entry prints a line.
 * 2. Run it with `--noEmit`, and with `--emitDeclarationOnly --declaration`.
 * 3. Assert both runs print the line and exit 0.
 */
export const test_ttsx_runs_the_entry_when_emit_suppressing_flags_are_forwarded =
  () => {
    const root = TestProject.createProject({
      "package.json": JSON.stringify({ name: "emitflags", private: true }),
      "tsconfig.json": JSON.stringify({
        compilerOptions: {
          target: "ES2022",
          module: "commonjs",
          strict: true,
          outDir: "dist",
          rootDir: "src",
          types: [],
        },
        include: ["src"],
      }),
      "src/main.ts": `const ran: string = "entry-ran";\nconsole.log(ran);\n`,
    });

    for (const flags of [
      ["--noEmit"],
      ["--emitDeclarationOnly", "--declaration"],
    ]) {
      const result = TestProject.spawn(
        TestProject.TTSX_BIN,
        ["--cwd", root, ...flags, "src/main.ts"],
        { cwd: root },
      );
      assert.equal(result.status, 0, `${flags.join(" ")}: ${result.stderr}`);
      assert.equal(result.stdout.trim(), "entry-ran", flags.join(" "));
    }
  };
