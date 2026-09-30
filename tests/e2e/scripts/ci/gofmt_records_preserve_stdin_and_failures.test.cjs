const assert = require("node:assert/strict");
const fs = require("node:fs");
const { test } = require("node:test");
const {
  workspace,
  bash,
  normalized,
  RAW_STRING_TAB,
} = require("./internal/gofmt-wrapper.cjs");

/**
 * Verifies the shared formatter keeps each source and failure independent.
 *
 * A malformed record must not hide later files or join literals across files.
 *
 * 1. Send complete files, fragments, CRLF, literal tabs and one parse failure.
 * 2. Compare every result with the original stdin path and preserve file labels.
 *
 * @evidence contracts/testing.md#behavioral-verification Real Go and Perl processes report every source's drift/error; assertions reject truncation and wrong parse status.
 * @evidence contracts/testing.md#independent-expectations The unchanged gofmt stdin mode supplies the formatting oracle; the malformed declaration independently requires failure status two.
 * @evidence contracts/testing.md#distinguishing-cases Full files, declaration/statement fragments, CRLF and literal tabs remain separate around a failing middle record, with Unicode and newline labels.
 * @evidence contracts/testing.md#execution-ownership This physical E2E file registers its named exported case once in the shared Node formatter population.
 * @evidence contracts/e2e.md#necessary-boundary Actual Go formatting and Perl framing must agree at the process boundary; pure formatting unit calls cannot verify their serialization or exit status.
 * @evidence contracts/e2e.md#shared-execution One actual batch serves all records; the unchanged stdin executions are required independent comparator reads rather than per-record new batch producers.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity One owned fixture carries matching wrapper/helper sources; each stdin request is independent and the directory is removed after every result is collected.
 * @evidence contracts/e2e.md#preserved-coverage Original literal/comment/write regressions remain unchanged; this case adds framing, partial programs and failures after and before valid records.
 */
const test_gofmt_records_preserve_stdin_and_failures = () => {
  const directory = workspace();
  try {
    const sources = [
      RAW_STRING_TAB,
      'const value = "a\tb"\n',
      "println(1)\n",
      "package a\r\n\r\nfunc A() {}\r\n",
    ];
    const expected = sources.map(normalized);
    const records = [...sources, ...expected].map((source, index) => ({
      file: `space 한글\n${index}.go`,
      source,
    }));
    records.splice(1, 0, {
      file: "broken.go",
      source: "package a\nfunc broken( {",
    });
    const result = bash(directory, ["--check-records"], {
      input: records.map((record) => JSON.stringify(record)).join("\n") + "\n",
    });
    assert.equal(result.status, 2, result.stderr);
    const output = result.stdout
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line));
    assert.deepEqual(
      output.map((record) => record.file),
      records.map((record) => record.file),
    );
    assert.match(output[1].error, /expected/);
    for (let index = 0; index < records.length; index++) {
      if (index === 1) continue;
      const current = records[index].source.replace(/\r\n/g, "\n");
      assert.equal(output[index].error, "");
      assert.equal(
        output[index].drift,
        expected[(index > 1 ? index - 1 : index) % sources.length] !== current,
      );
    }
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
};

module.exports = { test_gofmt_records_preserve_stdin_and_failures };

test(
  "framed checking preserves stdin formatting and every result after a parse error",
  test_gofmt_records_preserve_stdin_and_failures,
);
