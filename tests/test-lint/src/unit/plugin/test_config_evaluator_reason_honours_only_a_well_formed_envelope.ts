import { TestProject } from "../../../../utils/src/TestProject";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { configEvaluatorFailureReason } from "../../../../../packages/lint/src/internal/configEvaluatorFailure";

/**
 * Verifies only a well-formed envelope becomes an evaluation's failure reason.
 *
 * The evaluator streams the child's output past this process, so the one way a
 * failed evaluation can hand the caller a reason it can act on is the envelope
 * it writes into the result file the parent already reads. That file is also
 * where a successful evaluation writes its payload, and a non-zero exit can
 * follow a completed write — a config that sets `process.exitCode` from an
 * `exit` handler leaves a valid payload behind. So every shape other than the
 * envelope has to read as "no reason", or an ordinary payload becomes the error
 * message.
 *
 * 1. Point the reader at each shape the result file can hold.
 * 2. Assert only the envelope yields text, trimmed.
 * 3. Assert an absent file and every other shape yield the empty string.
 *
 * @evidence contracts/testing.md#behavioral-verification The authored configEvaluatorFailureReason reads actual temporary result files and returns trimmed loader-error text only for a string envelope.
 * @evidence contracts/testing.md#independent-expectations The result-file protocol reserves __ttscLoaderError for a textual failure; ordinary payloads, JSON primitives and malformed bytes cannot be failure explanations.
 * @evidence contracts/testing.md#distinguishing-cases Absent, blank, nested nonstring, payload, array, scalar, null, half-written and empty files return no reason; a valid whitespace-padded message is trimmed.
 * @evidence contracts/testing.md#execution-ownership This named source unit uses a disposable filesystem with finally cleanup, not a child evaluator. The real exit-without-envelope case remains an E2E transport owner.
 */
export function test_config_evaluator_reason_honours_only_a_well_formed_envelope(): void {
    const root = TestProject.tmpdir("ttsc-lint-reason-");
    try {
      assert.equal(
        configEvaluatorFailureReason(path.join(root, "absent.json")),
        "",
        "an evaluation that never wrote a result file names no reason",
      );

      for (const [name, content, expected] of [
        [
          "envelope",
          '{"__ttscLoaderError":"  the config said why  "}',
          "the config said why",
        ],
        ["blank-envelope", '{"__ttscLoaderError":"   "}', ""],
        [
          "non-string-envelope",
          '{"__ttscLoaderError":{"message":"nested"}}',
          "",
        ],
        ["payload", '{"dependencies":[],"entries":[]}', ""],
        ["array", '[{"__ttscLoaderError":"not at the root"}]', ""],
        ["scalar", '"__ttscLoaderError"', ""],
        ["null", "null", ""],
        ["half-written", '{"__ttscLoaderError":"cut off', ""],
        ["empty", "", ""],
      ] as const) {
        const location = path.join(root, `${name}.json`);
        fs.writeFileSync(location, content, "utf8");
        assert.equal(configEvaluatorFailureReason(location), expected, name);
      }
    } finally {
      fs.rmSync(root, { force: true, recursive: true });
    }
  }
