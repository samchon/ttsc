import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { assertTtsxNoWatch } from "../../../../../packages/ttsc/src/launcher/internal/assertTtsxNoWatch";
import { parseTtsxCLI } from "../../../../../packages/ttsc/src/launcher/internal/parseTtsxCLI";

/**
 * Verifies one-shot mode admission over real response files at the compiler cwd.
 * Parsing keeps the entry/program boundary; preparation's exact shared guard
 * observes only the compiler projection. No compiler, program or watcher runs.
 *
 * @evidence contracts/testing.md#behavioral-verification The actual parser feeds its compiler projection to the actual pre-build guard with a real selected-project directory and authored response bytes; supported requests return and unsupported or unreadable requests throw.
 * @evidence contracts/testing.md#independent-expectations One-shot execution refuses every watch spelling even with false/null operands; scalar @ values and program arguments are data, and relative nested frames retain the compiler cwd.
 * @evidence contracts/testing.md#distinguishing-cases Direct, nested, repeated, mixed-case and false/null watch requests, UTF-8/BOM/UTF-16 encodings, changed/missing/cyclic/malformed files, @ scalar operands, program tails and terminal precedence distinguish actual admission from a top-level token scan or historical result cache.
 * @evidence contracts/testing.md#execution-ownership One synchronous test owns one mkdtemp root and removes it in finally; actual parser and exported guard perform only native file reads and hashing. Native compilation, process spawning, cache writes and watcher registration are absent.
 */
export function test_ttsx_response_watch_admission_preserves_compiler_and_program_boundaries(): void {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ttsx-response-guard-"));
  const failures: Error[] = [];
  const check = (name: string, action: () => void): void => {
    try {
      action();
    } catch (cause) {
      failures.push(new Error(name, { cause }));
    }
  };
  const admit = (argv: string[]): void => {
    const parsed = parseTtsxCLI(argv);
    assert.equal(typeof parsed, "object");
    if (typeof parsed === "string") throw new Error("expected entry options");
    assertTtsxNoWatch(parsed.tsgoFlags, root);
  };
  const file = path.join(root, "flags.rsp");
  try {
    for (const text of ["--watch", "-w", "--WATCH false", "--watch null"])
      check(text, () => {
        fs.writeFileSync(file, text);
        assert.throws(
          () => admit(["@flags.rsp", "entry.ts"]),
          /--watch is not supported/,
        );
      });
    for (const encoding of ["utf8", "utf8-bom", "utf16le", "utf16be"]) {
      check(encoding, () => {
        const text = "--watch false";
        const bytes = encoding.startsWith("utf16")
          ? Buffer.concat([
              Buffer.from([0xff, 0xfe]),
              Buffer.from(text, "utf16le"),
            ])
          : Buffer.from((encoding === "utf8-bom" ? "\ufeff" : "") + text);
        if (encoding === "utf16be") bytes.swap16();
        fs.writeFileSync(file, bytes);
        assert.throws(
          () => admit(["@flags.rsp", "entry.ts"]),
          /--watch is not supported/,
        );
      });
    }
    check("nested frames use compiler cwd", () => {
      fs.mkdirSync(path.join(root, "nested"));
      fs.writeFileSync(path.join(root, "nested", "outer.rsp"), "@flags.rsp");
      fs.writeFileSync(file, "--watch");
      assert.throws(
        () => admit(["@nested/outer.rsp", "entry.ts"]),
        /--watch is not supported/,
      );
    });
    check("current contents and repeated frames", () => {
      fs.writeFileSync(file, "--target es2022");
      admit(["@flags.rsp", "@flags.rsp", "entry.ts"]);
      fs.writeFileSync(file, "--watch");
      assert.throws(
        () => admit(["@flags.rsp", "entry.ts"]),
        /--watch is not supported/,
      );
      fs.writeFileSync(file, "--target es2022");
      admit(["@flags.rsp", "entry.ts"]);
    });
    check("scalar operands retain @ and dash text", () => {
      fs.writeFileSync(file, "--outDir @missing --rootDir --watch");
      admit(["@flags.rsp", "entry.ts"]);
      admit(["--outDir", "@missing", "entry.ts"]);
    });
    check("program tails and terminals never open response files", () => {
      admit(["entry.ts", "@missing", "--watch"]);
      assert.equal(parseTtsxCLI(["@missing", "--help"]), "help");
      assert.equal(parseTtsxCLI(["--version", "@missing"]), "version");
    });
    for (const [name, text, expected] of [
      ["cycle", "@flags.rsp", /Cyclic compiler response file/],
      ["quote", '"--watch', /Unterminated compiler response quote/],
    ] as const)
      check(name, () => {
        fs.writeFileSync(file, text);
        assert.throws(() => admit(["@flags.rsp", "entry.ts"]), expected);
      });
    check("incomplete UTF16 and missing response fail", () => {
      fs.writeFileSync(file, Buffer.from([0xff, 0xfe, 0x20]));
      assert.throws(() => admit(["@flags.rsp", "entry.ts"]), /Incomplete UTF-16/);
      fs.unlinkSync(file);
      assert.throws(() => admit(["@flags.rsp", "entry.ts"]), /ENOENT/);
    });
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
  if (failures.length !== 0)
    throw new AggregateError(failures, "ttsx response admission failed");
}
