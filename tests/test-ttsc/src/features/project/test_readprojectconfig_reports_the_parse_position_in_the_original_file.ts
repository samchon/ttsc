import { TestProject } from "../../../../utils/src/TestProject";

import { assert, fs, path, readProjectConfig } from "../../internal/project-unit";

/**
 * Verifies the reported parse position points into the file the user edited.
 *
 * The reader counts lines in the text the user edited, so a failure behind
 * comments names the line where the error sits, not a line in some rewritten
 * intermediate string, and a position that is confidently wrong is worse than
 * none. Here the error sits on line 6 behind three lines of comments. The
 * boundary rows are the files holding no value, which the compiler reads as an
 * empty config.
 *
 * 1. Write a config whose unterminated object ends on line 6, behind a line
 *    comment and a two-line block comment.
 * 2. Assert the message names the file and reports line 6.
 * 3. Assert an empty file and a comments-only file read as empty configs, and that
 *    valid JSONC with comments, a trailing comma, and a BOM still parses.
 *
 * @evidence contracts/testing.md#behavioral-verification Checks line-six error attribution behind comments, empty and comment-only acceptance, non-object rejection and valid BOM JSONC, detecting location shifts introduced by intermediate parsing text.
 * @evidence contracts/testing.md#independent-expectations The fixture explicitly places its missing delimiter at the end of line six; expected line and semantic boundaries follow the authored bytes and JSONC object contract.
 * @evidence contracts/testing.md#distinguishing-cases Malformed text contrasts with empty, comments-only and valid BOM/comment/trailing-comma text; a JSON string root separately distinguishes syntactic validity from config validity.
 * @evidence contracts/testing.md#execution-ownership A unit test calling readProjectConfig directly on a tsconfig with an unterminated object behind comments, plus empty, comment-only, string-root and BOM/JSONC files in a private temp directory; no install, native build, compiler process or CLI is involved.
 */
export const test_readprojectconfig_reports_the_parse_position_in_the_original_file =
  () => {
    const root = TestProject.physicalPath(TestProject.tmpdir("ttsc-project-"));
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

    // Boundary: a file holding no value at all is an empty config to the
    // compiler, not a parse failure.
    for (const contents of ["", "// only a comment\n"]) {
      fs.writeFileSync(file, contents, "utf8");
      assert.deepEqual(
        readProjectConfig({ tsconfig: file }).compilerOptions.plugins,
        [],
      );
    }

    // Boundary: valid JSON that is not an object is not a configuration, as
    // the compiler's TS5092 says, and its failure is attributed the same way.
    fs.writeFileSync(file, `"not an object"`, "utf8");
    assert.throws(
      () => readProjectConfig({ tsconfig: file }),
      (error: unknown) =>
        error instanceof Error &&
        error.message.startsWith(`ttsc: failed to parse ${file}: `) &&
        /must be an object/.test(error.message),
    );

    // Negative twin: counting lines in the original text must not change what
    // parses. Comments, a trailing comma, and a leading BOM together — the shapes the
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
