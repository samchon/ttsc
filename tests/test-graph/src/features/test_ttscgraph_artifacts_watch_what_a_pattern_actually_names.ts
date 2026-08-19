import assert from "node:assert/strict";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const graphLib = path.dirname(require.resolve("@ttsc/graph"));
const { watchedBy } = require(
  path.join(graphLib, "model", "publishedArtifacts.js"),
) as {
  watchedBy(
    pattern: string,
    cwd: string,
  ): { path: string; recursive: boolean } | null;
};

/** The project root every pattern below is resolved against. */
const CWD = path.resolve("/workspace/project");

/**
 * Verifies a declared pattern is translated into what it actually names.
 *
 * The artifact refresh watches paths before every graph request, so what a
 * pattern is taken to mean is a cost decision as much as a correctness one, and
 * the two failures pull in opposite directions.
 *
 * Reading a pattern as broader than it is makes the walk unbounded in the case
 * that looks most harmless: `*.md` has the project root for its fixed prefix,
 * so treating it as recursive states every file in the repository — before
 * every request. Reading it as narrower leaves declared documents unwatched,
 * which is the staleness this whole mechanism exists to remove.
 *
 * The `null` answer is the third reading: a pattern with no wildcard names one
 * file, and watching its parent directory instead would state every sibling to
 * learn about the one path that was declared.
 *
 * 1. Translate a recursive glob, a shallow one, a rootless one, and an exact path.
 * 2. Assert each names the directory and the depth its own syntax states.
 */
export const test_ttscgraph_artifacts_watch_what_a_pattern_actually_names =
  (): void => {
    const cases: {
      pattern: string;
      expected: { path: string; recursive: boolean } | null;
      why: string;
    }[] = [
      {
        expected: { path: path.join(CWD, "docs"), recursive: true },
        pattern: "docs/**/*.md",
        why: "a `**` pattern descends, so its whole tree is watched",
      },
      {
        expected: { path: path.join(CWD, "docs"), recursive: false },
        pattern: "docs/*.md",
        why: "a single `*` names one directory's files and must not descend",
      },
      {
        expected: { path: CWD, recursive: false },
        pattern: "*.md",
        why: "a pattern with no directory part names the project root, and reading it as recursive walks the entire repository per request",
      },
      {
        expected: { path: path.join(CWD, "docs", "api"), recursive: true },
        pattern: "docs/api/**",
        why: "a trailing `**` still fixes its prefix as the directory to walk",
      },
      {
        expected: null,
        pattern: "docs/architecture.md",
        why: "a pattern with no wildcard names one file, not the directory holding it",
      },
    ];

    for (const item of cases) {
      const actual = watchedBy(item.pattern, CWD);
      assert.deepEqual(
        actual,
        item.expected,
        `${item.pattern}: ${item.why} — got ${JSON.stringify(actual)}`,
      );
    }
  };
