import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { pluginDescriptorFailureReason } from "../../../../../packages/ttsc/lib/plugin/internal/descriptorProcessFailure.js";

/**
 * Verifies only a well-formed envelope becomes a descriptor's failure reason.
 *
 * The shim streams its stack past this process, so the one way a failed
 * evaluation hands the caller a reason it can act on is the envelope it writes
 * into the result file the parent already reads. That file is also where a
 * successful evaluation writes the descriptor itself, and a non-zero exit can
 * follow a completed write. So every shape other than the envelope has to read
 * as "no reason", or an ordinary descriptor becomes the error message.
 *
 * The twin of
 * `test_config_evaluator_reason_honours_only_a_well_formed_envelope` on the
 * `@ttsc/lint` side: the two readers are separate copies in separate packages,
 * so each carries its own proof.
 *
 * 1. Point the reader at each shape the result file can hold.
 * 2. Assert only the envelope yields text, trimmed.
 * 3. Assert an absent file and every other shape yield the empty string.
 */
export const test_plugin_descriptor_reason_honours_only_a_well_formed_envelope =
  (): void => {
    const root = TestProject.tmpdir("ttsc-descriptor-reason-");
    try {
      assert.equal(
        pluginDescriptorFailureReason(path.join(root, "absent.json")),
        "",
        "a shim that never wrote a result file names no reason",
      );

      for (const [name, content, expected] of [
        [
          "envelope",
          '{"__ttscLoaderError":"  the descriptor said why  "}',
          "the descriptor said why",
        ],
        ["blank-envelope", '{"__ttscLoaderError":"   "}', ""],
        [
          "non-string-envelope",
          '{"__ttscLoaderError":{"message":"nested"}}',
          "",
        ],
        ["descriptor", '{"name":"real","source":"/somewhere"}', ""],
        ["array", '[{"__ttscLoaderError":"not at the root"}]', ""],
        ["scalar", '"__ttscLoaderError"', ""],
        ["null", "null", ""],
        ["half-written", '{"__ttscLoaderError":"cut off', ""],
        ["empty", "", ""],
      ] as const) {
        const location = path.join(root, `${name}.json`);
        fs.writeFileSync(location, content, "utf8");
        assert.equal(pluginDescriptorFailureReason(location), expected, name);
      }
    } finally {
      fs.rmSync(root, { force: true, recursive: true });
    }
  };
