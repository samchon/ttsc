import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { listLintCases } from "../../helpers/assertLintCase";

/**
 * Verifies corpus discovery recognizes every supported TypeScript suffix.
 *
 * A suffix omitted from discovery would silently bypass the classification
 * contract as soon as a matching fixture is added. The compiler's wildcard
 * scanner recognizes only canonical lowercase suffixes, so case variants must
 * fail explicitly instead of being silently excluded from the program.
 *
 * 1. Materialize every canonical TypeScript suffix and a JavaScript control.
 * 2. Discover exactly the lowercase TypeScript sources.
 * 3. Add each uppercase suffix in turn and assert discovery rejects it.
 */
export const test_lint_corpus_discovery_supports_typescript_source_extensions =
  (): void => {
    const root = fs.mkdtempSync(
      path.join(os.tmpdir(), "ttsc-lint-source-extensions-"),
    );
    const files = [
      "case.ts",
      "case.tsx",
      "case.mts",
      "case.cts",
      "case.d.ts",
      "case.d.mts",
      "case.d.cts",
    ];
    const nonCanonicalFiles = [
      "uppercase-ts.TS",
      "uppercase-tsx.TSX",
      "uppercase-mts.MTS",
      "uppercase-cts.CTS",
      "uppercase-dts.D.TS",
      "uppercase-dmts.D.MTS",
      "uppercase-dcts.D.CTS",
    ];
    try {
      for (const file of files) {
        fs.writeFileSync(
          path.join(root, file),
          "// expect: fixture/rule error\nexport {};\n",
          "utf8",
        );
      }
      fs.writeFileSync(path.join(root, "ignored.js"), "export {};\n", "utf8");
      assert.deepEqual(listLintCases(root), [...files].sort());
      for (const file of nonCanonicalFiles) {
        const target = path.join(root, file);
        fs.writeFileSync(
          target,
          "// expect: fixture/rule error\nexport {};\n",
          "utf8",
        );
        assert.throws(
          () => listLintCases(root),
          new RegExp(`${file.replaceAll(".", "\\.")}.*canonical lowercase`),
        );
        fs.rmSync(target);
      }
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  };
