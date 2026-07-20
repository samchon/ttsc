import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";

/**
 * Verifies ttsx preloads every `--require` occurrence, in order, for every
 * spelling the engine accepts.
 *
 * The launcher rebuilt the repeatable preload list with a hand-written scan
 * over raw argv whose boundary test was `looksLikeEntryFile`. Applied to raw
 * tokens that predicate cannot tell an entry from a `--require` value carrying
 * a TypeScript extension, nor from an inline `--require=<x>.ts` token, so the
 * scan stopped before the tokens it existed to collect. Every failing shape
 * exited 0 with an empty stderr and simply ran without its preload. The cases
 * must drive the real launcher: the two inline shapes already reached `values`
 * correctly, so a parser-level assertion would have passed against the defect.
 *
 * 1. Create `.cjs`, `.ts`, and `.tsx` preloads that each announce themselves.
 * 2. Run ttsx once per argv shape: spaced, inline long, inline short, and mixed.
 * 3. Assert each run prints its preloads in argv order before the entry's line.
 */
export const test_ttsx_preloads_every_require_spelling_before_the_entry =
  () => {
    const root = TestProject.createProject({
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
      "a.cjs": `console.log("PRELOAD a.cjs");\n`,
      "b.cjs": `console.log("PRELOAD b.cjs");\n`,
      "a.ts": `console.log("PRELOAD a.ts");\n`,
      "c.tsx": `console.log("PRELOAD c.tsx");\n`,
      "src/main.ts": `console.log("ENTRY");\n`,
    });

    const cases: [string[], string[]][] = [
      [
        ["-r", "./a.cjs", "-r", "./b.cjs"],
        ["PRELOAD a.cjs", "PRELOAD b.cjs"],
      ],
      // A TypeScript preload is the expected case for a TypeScript runner, and
      // it is the shape that used to truncate the scan and drop every later
      // occurrence.
      [
        ["-r", "./a.ts", "-r", "./b.cjs"],
        ["PRELOAD a.ts", "PRELOAD b.cjs"],
      ],
      [["--require=./a.ts"], ["PRELOAD a.ts"]],
      [
        ["--require=./a.ts", "-r", "./b.cjs"],
        ["PRELOAD a.ts", "PRELOAD b.cjs"],
      ],
      [["-r=./a.cjs"], ["PRELOAD a.cjs"]],
      [
        ["-r", "./c.tsx", "-r", "./b.cjs"],
        ["PRELOAD c.tsx", "PRELOAD b.cjs"],
      ],
    ];

    for (const [flags, expected] of cases) {
      const result = TestProject.spawn(
        TestProject.TTSX_BIN,
        ["--cwd", root, ...flags, "src/main.ts"],
        { cwd: root },
      );
      const label = flags.join(" ");
      assert.equal(result.status, 0, `ttsx ${label}:\n${result.stderr}`);
      assert.deepEqual(
        result.stdout
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter((line) => line.length !== 0),
        [...expected, "ENTRY"],
        `ttsx ${label} must preload every occurrence in order`,
      );
    }
  };
