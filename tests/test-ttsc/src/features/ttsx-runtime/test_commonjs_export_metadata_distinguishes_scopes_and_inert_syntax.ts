import assert from "node:assert/strict";
import { createRequire } from "node:module";

import { parseCommonJsExports } from "../../../../../packages/ttsc/src/launcher/internal/parseCommonJsExports";

/**
 * Verifies real star-helper metadata across scopes without scanning inert text.
 *
 * The reader supplements Node's frozen lexer with executable AST call shapes.
 * Strings and regex delimiters must neither invent nor hide re-export edges.
 *
 * 1. Parse top-level, block, IIFE and static-block helper calls with literal
 *    targets.
 * 2. Surround real calls with regex, division, comment and template
 *    counterexamples.
 * 3. Assert exact exports and ordered unique re-export edges, including empty and
 *    malformed inputs.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls the authored parseCommonJsExports on actual CommonJS program inputs and asserts exact exported names and re-export edges; inert text must never become metadata and nested executable helper calls must remain discoverable.
 * @evidence contracts/testing.md#independent-expectations Each source is authored with a known literal require target, so the expected re-export list (for example ["./actual"], ["./a", "./b"] in first-call order, or [] for text that only looks like a call) and the expected export names (`exports.text`, `exports.actual` assignments) follow from the source text rather than from the parser's output.
 * @evidence contracts/testing.md#distinguishing-cases Both inline and member helper spellings cover top/block/IIFE/static scopes, false unbraced condition, regex backtick and division; quoted/template/comment lookalikes, wrong helper/nested target, native top-level coarse metadata, optional calls, dynamic arguments, duplicates, empty and malformed inputs distinguish adjacent rejection cases.
 * @evidence contracts/testing.md#execution-ownership Unit test discovered once under src/features/ttsx-runtime; it initializes cjs-module-lexer synchronously and calls parseCommonJsExports on in-memory source strings, collecting every failing case into one AggregateError. No file is written, no consumer installed, no native artifact built and no host started.
 */
export function test_commonjs_export_metadata_distinguishes_scopes_and_inert_syntax(): void {
  const { initSync } = createRequire(
    new URL("../../../../../packages/ttsc/package.json", import.meta.url),
  )("cjs-module-lexer") as { initSync(): void };
  initSync();
  const failures: Error[] = [];
  const check = (
    label: string,
    source: string,
    exports: string[],
    reexports: string[],
  ) => {
    try {
      assert.deepEqual(
        parseCommonJsExports(source),
        { exports, reexports },
        label,
      );
    } catch (error) {
      failures.push(new Error(label, { cause: error }));
    }
  };
  for (const helper of ["__exportStar", "tslib_1.__exportStar"]) {
    const call = helper + '(require("./actual"), exports);';
    for (const [scope, body] of [
      ["top", call],
      ["block", "if (true) {" + call + "}"],
      ["iife", "(function(){" + call + "})();"],
      ["class", "class ExportScope { static {" + call + "} }"],
      ["false-condition", "if (false) " + call],
    ]) {
      for (const prefix of [
        "",
        "const marker = /`/;",
        "const ratio = 8 / 2 / 2;",
      ])
        check(
          helper + "/" + scope + "/" + prefix,
          prefix + body,
          [],
          ["./actual"],
        );
    }
    const lookalike = helper + '(require("./ghost"), exports);';
    for (const source of [
      "exports.text = " + JSON.stringify(lookalike) + ";",
      "exports.text = `\n" + lookalike + "\n`;",
      "// " + lookalike + "\nexports.actual = 17;",
      "/* " + lookalike + " */ exports.actual = 17;",
    ])
      check(
        helper + "/inert/" + source,
        source,
        source.startsWith("exports.text") ? ["text"] : ["actual"],
        [],
      );
  }
  check(
    "ordered-deduplicated",
    '__exportStar(require("./a"), exports); if(true){ __exportStar(require("./b"), exports); } __exportStar(require("./a"), exports);',
    [],
    ["./a", "./b"],
  );
  for (const source of [
    "__exportStar(require(name), exports);",
    'if(true){ __exportStar(require("./x"), other); }',
    'otherHelper(require("./x"), exports);',
    '__exportStar?.(require("./x"), exports);',
    '__exportStar(require?.("./x"), exports);',
  ])
    check("unsupported-call/" + source, source, [], []);
  // Native frozen lexer metadata remains authoritative even where it is coarse.
  check(
    "native-top-level-target",
    '__exportStar(require("./x"), other);',
    [],
    ["./x"],
  );
  check("empty", "", [], []);
  check("malformed", "__exportStar(require(", [], []);
  if (failures.length)
    throw new AggregateError(
      failures,
      "CommonJS export metadata distinctions failed",
    );
}
