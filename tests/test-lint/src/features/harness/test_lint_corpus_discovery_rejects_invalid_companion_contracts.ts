import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { listLintCases } from "../../helpers/assertLintCase";

/**
 * Verifies lint corpus companions: malformed, conflicting, and orphan roles
 * fail.
 *
 * A companion exclusion is safe only when its directive is exact, exclusive,
 * and consumed by one positive entry in the grouped case. Otherwise the marker
 * would recreate the silent-drop path under a different name.
 *
 * 1. Materialize malformed, duplicate, conflicting, orphan, and ambiguous roles.
 * 2. Run strict discovery against each isolated corpus root.
 * 3. Assert every invalid contract fails for its structural reason.
 */
export const test_lint_corpus_discovery_rejects_invalid_companion_contracts =
  (): void => {
    const validEntry =
      "// expect: fixture/rule error\nexport const violation = true;\n";
    const scenarios: readonly {
      name: string;
      files: Readonly<Record<string, string>>;
      error: RegExp;
    }[] = [
      {
        name: "malformed",
        files: {
          "case/violation.ts": validEntry,
          "case/src/helper.ts":
            "// @ttsc-corpus-companion: helper\nexport {};\n",
        },
        error: /helper\.ts: malformed `\/\/ @ttsc-corpus-companion` directive/,
      },
      {
        name: "duplicate",
        files: {
          "case/violation.ts": validEntry,
          "case/src/helper.ts":
            "// @ttsc-corpus-companion\n// @ttsc-corpus-companion\nexport {};\n",
        },
        error:
          /helper\.ts: a corpus source may declare at most one companion directive/,
      },
      {
        name: "expectation-conflict",
        files: {
          "case/violation.ts": validEntry,
          "case/src/helper.ts":
            "// @ttsc-corpus-companion\n// expect: fixture/rule error\nexport {};\n",
        },
        error: /helper\.ts: a corpus companion cannot declare expectations/,
      },
      {
        name: "skip-conflict",
        files: {
          "case/violation.ts": validEntry,
          "case/src/helper.ts":
            "// @ttsc-corpus-companion\n// @ttsc-corpus-skip(project): packages\/lint\/test\/fixture_test.go\nexport {};\n",
        },
        error: /helper\.ts: a corpus companion cannot also be an audited skip/,
      },
      {
        name: "entry-directive-conflict",
        files: {
          "case/violation.ts": validEntry,
          "case/src/helper.ts":
            "// @ttsc-corpus-companion\n// @ttsc-corpus-filename: src/helper.ts\nexport {};\n",
        },
        error: /helper\.ts: a corpus companion cannot declare entry directives/,
      },
      {
        name: "root-orphan",
        files: {
          "entry.ts": validEntry,
          "src/helper.ts": "// @ttsc-corpus-companion\nexport {};\n",
        },
        error:
          /helper\.ts: a corpus companion must belong to exactly one positive entry whose case directory contains it under src\//,
      },
      {
        name: "missing-owner",
        files: {
          "entry.ts": validEntry,
          "case/src/helper.ts": "// @ttsc-corpus-companion\nexport {};\n",
        },
        error:
          /helper\.ts: a corpus companion must belong to exactly one positive entry whose case directory contains it under src\//,
      },
      {
        name: "ambiguous-owner",
        files: {
          "case/one.ts": validEntry,
          "case/two.ts": validEntry,
          "case/src/helper.ts": "// @ttsc-corpus-companion\nexport {};\n",
        },
        error:
          /helper\.ts: a corpus companion must belong to exactly one positive entry whose case directory contains it under src\//,
      },
    ];

    for (const scenario of scenarios) {
      const root = fs.mkdtempSync(
        path.join(os.tmpdir(), `ttsc-lint-companion-${scenario.name}-`),
      );
      try {
        for (const [relativeFile, source] of Object.entries(scenario.files)) {
          const target = path.join(root, relativeFile);
          fs.mkdirSync(path.dirname(target), { recursive: true });
          fs.writeFileSync(target, source, "utf8");
        }
        assert.throws(() => listLintCases(root), scenario.error);
      } finally {
        fs.rmSync(root, { recursive: true, force: true });
      }
    }
  };
