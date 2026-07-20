import { TestProject } from "@ttsc/testing";

import { assert, fs, path, readProjectConfig } from "../../internal/project";

/**
 * Verifies the reported parse position points into the file the user edited.
 *
 * The reader strips comments and trailing commas before `JSON.parse`, so a
 * position reported against that intermediate string names the wrong line
 * whenever comments precede the error, and a position that is confidently wrong
 * is worse than none. Comment, trailing-comma, and BOM removal is therefore
 * length-preserving: each removed character becomes a space and each removed
 * newline stays a newline. Here the error sits on line 6 behind three lines of
 * comments; a shrinking strip reports line 3. The boundary rows are the inputs
 * whose failure carries no position at all, which must still be attributed.
 *
 * 1. Write a config whose unterminated object ends on line 6, behind a line
 *    comment and a two-line block comment.
 * 2. Assert the message names the file and reports line 6.
 * 3. Assert an empty file and a comments-only file are attributed too, and that
 *    valid JSONC with comments, a trailing comma, and a BOM still parses.
 */
export const test_readprojectconfig_reports_the_parse_position_in_the_original_file =
  () => {
    const root = TestProject.tmpdir("ttsc-project-");
    const file = path.join(root, "tsconfig.json");
    fs.writeFileSync(
      file,
      [
        "// a leading line comment",
        "/* a block comment",
        "   spanning two lines */",
        "{",
        `  "compilerOptions": { "strict": true`,
        "",
      ].join("\n"),
      "utf8",
    );
    assert.throws(
      () => readProjectConfig({ tsconfig: file }),
      (error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        assert.equal(message.includes(file), true, message);
        assert.match(
          message,
          /line 6\b/,
          `the reported line must be the line in the original file: ${message}`,
        );
        return true;
      },
    );

    // Boundary: inputs whose failure carries no position must still be named.
    for (const contents of ["", "// only a comment\n"]) {
      fs.writeFileSync(file, contents, "utf8");
      assert.throws(
        () => readProjectConfig({ tsconfig: file }),
        (error: unknown) => {
          const message =
            error instanceof Error ? error.message : String(error);
          assert.match(message, /^ttsc: failed to parse /);
          assert.equal(message.includes(file), true, message);
          return true;
        },
      );
    }

    // Negative twin: the length-preserving rewrite must not change what parses.
    // Comments, a trailing comma, and a leading BOM together — the shapes the
    // JSONC cases and closed issue #216 pinned.
    fs.writeFileSync(
      file,
      `﻿{
      // a comment
      "compilerOptions": {
        "strict": true, /* trailing */
      },
    }\n`,
      "utf8",
    );
    assert.equal(
      readProjectConfig({ tsconfig: file }).compilerOptions.strict,
      true,
    );
  };
