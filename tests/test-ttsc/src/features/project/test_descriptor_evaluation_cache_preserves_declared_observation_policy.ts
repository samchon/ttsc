import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { PluginDescriptorEvaluationCache } from "../../../../../packages/ttsc/src/plugin/internal/load/PluginDescriptorEvaluationCache";
import { declaresHostInputReads } from "../../../../../packages/ttsc/src/plugin/internal/load/declaresHostInputReads";

/**
 * Verifies descriptor persistence follows supplied content and physical proofs.
 *
 * These authored evaluations exercise declaration and cache policy, not a
 * descriptor producer's completeness or honesty. A cache miss requests another
 * evaluation from the caller; this unit does not execute that evaluator.
 *
 * 1. Contrast declaration presence and key coverage with value validation.
 * 2. Publish authored observations and change content, candidates and targets.
 * 3. Refuse incomplete/conflicting proofs and malformed or unreadable entries.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls actual declaresHostInputReads and PluginDescriptorEvaluationCache.write/read on private files. Literal declaration booleans, exact returned evaluations, absent publication and null misses distinguish declaration, persistence and currentness.
 * @evidence contracts/testing.md#independent-expectations Independent SHA-256 over authored bytes and native realpath over owned inputs supply observations; unchanged inputs permit the exact authored answer, changed bytes/candidate existence/physical target require null. Explicit declaration tables and writer refusals are contract expectations, not outputs copied from cache helpers.
 * @evidence contracts/testing.md#distinguishing-cases Includes empty/absent/malformed declarations, missing input keys, invalid declared values, incomplete observations, conflicting declared content, empty proof, extra external content without invented realpath, unchanged hits, content movement/restoration, missing candidate appearance, identical-content directory-link retargeting, prior proof-generation and foreign-format refusal, corrupt entries and a directory at the entry path. Directory read refusal is not certification of permission-denied input behavior.
 * @evidence contracts/testing.md#execution-ownership One matching source unit directly invokes production-used policies without locate, evaluator, Go, compiler, installation or product host. Native files and a Windows junction/POSIX directory link are owned inputs; failures are aggregated and final root cleanup errors retained. Authored observation completeness is a premise, not producer or atomic-snapshot certification; selection/runtime remain unexecuted.
 */
export function test_descriptor_evaluation_cache_preserves_declared_observation_policy(): void {
  const root = fs.realpathSync.native(
    fs.mkdtempSync(path.join(os.tmpdir(), "ttsc-descriptor-policy-")),
  );
  const failures: Error[] = [];
  const check = (name: string, operation: () => void): void => {
    try {
      operation();
    } catch (cause) {
      failures.push(new Error(name, { cause }));
    }
  };
  const digest = (bytes: string): string =>
    crypto.createHash("sha256").update(bytes).digest("hex");
  const input = path.join(root, "descriptor.cjs");
  const external = path.join(root, "settings.json");
  const missing = path.join(root, "optional.cjs");
  const bytes = "descriptor input\n";
  const settings = '{"value":"first"}\n';
  try {
    fs.writeFileSync(input, bytes, "utf8");
    fs.writeFileSync(external, settings, "utf8");
    const rows: readonly [string, unknown, boolean][] = [
      ["absent descriptor", undefined, false],
      ["null descriptor", null, false],
      ["array descriptor", [], false],
      ["undeclared reads", {}, false],
      ["null fingerprints", { hostInputHashes: null }, false],
      ["array fingerprints", { hostInputHashes: [] }, false],
      ["explicit no reads", { hostInputHashes: {} }, true],
      ["declared empty inputs", { hostInputs: [], hostInputHashes: {} }, true],
      [
        "missing fingerprint key",
        { hostInputs: [input], hostInputHashes: {} },
        false,
      ],
      ["nonstring input", { hostInputs: [0], hostInputHashes: {} }, false],
      ["nonarray inputs", { hostInputs: input, hostInputHashes: {} }, false],
      [
        "covered resolved spelling",
        {
          hostInputs: [
            `${root}${path.sep}child${path.sep}..${path.sep}descriptor.cjs`,
          ],
          hostInputHashes: { [input]: digest(bytes) },
        },
        true,
      ],
      [
        "declaration does not validate values",
        { hostInputs: [input], hostInputHashes: { [input]: 42 } },
        true,
      ],
    ];
    for (const [name, descriptor, expected] of rows)
      check(`declaration/${name}`, () =>
        assert.equal(declaresHostInputReads(descriptor), expected),
      );
    const evaluation = (): PluginDescriptorEvaluationCache.IEvaluation => ({
      descriptor: { name: "authored", hostInputHashes: {} },
      hostInputHashes: { [input]: digest(bytes) },
      hostInputRealpaths: { [input]: fs.realpathSync.native(input) },
      inputs: [input],
      observationsComplete: true,
    });
    const refusals: readonly [
      string,
      (value: PluginDescriptorEvaluationCache.IEvaluation) => void,
    ][] = [
      [
        "incomplete",
        (value) => {
          value.observationsComplete = false;
        },
      ],
      [
        "undeclared",
        (value) => {
          value.descriptor = {};
        },
      ],
      [
        "missing hash",
        (value) => {
          value.hostInputHashes = {};
        },
      ],
      [
        "missing realpath",
        (value) => {
          value.hostInputRealpaths = {};
        },
      ],
      [
        "conflicting content",
        (value) => {
          value.descriptor = { hostInputHashes: { [input]: digest("other") } };
        },
      ],
      [
        "invalid declared value",
        (value) => {
          value.descriptor = { hostInputHashes: { [input]: 42 } };
        },
      ],
      [
        "relative declared key",
        (value) => {
          value.descriptor = {
            hostInputHashes: { "relative.txt": digest(bytes) },
          };
        },
      ],
      [
        "empty proof",
        (value) => {
          value.inputs = [];
          value.hostInputHashes = {};
          value.hostInputRealpaths = {};
        },
      ],
    ];
    for (const [name, mutate] of refusals)
      check(`write/${name}`, () => {
        const value = evaluation();
        mutate(value);
        const entry = path.join(root, "refusals", `${name}.json`);
        PluginDescriptorEvaluationCache.write(entry, value);
        assert.equal(fs.existsSync(entry), false);
        assert.equal(PluginDescriptorEvaluationCache.read(entry), null);
      });
    check("unchanged/content moved/restored", () => {
      const entry = path.join(root, "unchanged.json");
      const value = evaluation();
      const before = JSON.stringify(value);
      PluginDescriptorEvaluationCache.write(entry, value);
      assert.equal(JSON.stringify(value), before);
      assert.deepEqual(PluginDescriptorEvaluationCache.read(entry), value);
      try {
        const metadata = fs.statSync(input);
        fs.writeFileSync(input, "different input!\n", "utf8");
        fs.utimesSync(input, metadata.atime, metadata.mtime);
        assert.equal(fs.statSync(input).size, metadata.size);
        assert.equal(PluginDescriptorEvaluationCache.read(entry), null);
        fs.writeFileSync(input, bytes, "utf8");
        assert.deepEqual(PluginDescriptorEvaluationCache.read(entry), value);
        fs.rmSync(input);
        assert.equal(PluginDescriptorEvaluationCache.read(entry), null);
      } finally {
        fs.writeFileSync(input, bytes, "utf8");
      }
    });
    check("prior producer proof generation", () => {
      const entry = path.join(root, "previous-generation.json");
      const value = evaluation();
      PluginDescriptorEvaluationCache.write(entry, value);
      assert.deepEqual(PluginDescriptorEvaluationCache.read(entry), value);
      const stored = JSON.parse(fs.readFileSync(entry, "utf8")) as {
        format: string;
      };
      stored.format = "ttsc-descriptor-evaluation-v6";
      fs.writeFileSync(entry, JSON.stringify(stored));
      assert.equal(PluginDescriptorEvaluationCache.read(entry), null);
      PluginDescriptorEvaluationCache.write(entry, value);
      assert.deepEqual(PluginDescriptorEvaluationCache.read(entry), value);
    });
    check("missing candidate appearance", () => {
      const entry = path.join(root, "candidate.json");
      const value = evaluation();
      value.inputs.push(missing);
      value.hostInputHashes[missing] = null;
      value.hostInputRealpaths[missing] = null;
      PluginDescriptorEvaluationCache.write(entry, value);
      assert.deepEqual(PluginDescriptorEvaluationCache.read(entry), value);
      fs.writeFileSync(missing, "optional\n", "utf8");
      assert.equal(PluginDescriptorEvaluationCache.read(entry), null);
      fs.rmSync(missing);
      assert.deepEqual(PluginDescriptorEvaluationCache.read(entry), value);
    });
    check("declared external content without physical observation", () => {
      const entry = path.join(root, "external.json");
      const value = evaluation();
      value.descriptor = {
        name: "external",
        hostInputs: [external],
        hostInputHashes: { [external]: digest(settings) },
      };
      PluginDescriptorEvaluationCache.write(entry, value);
      assert.deepEqual(PluginDescriptorEvaluationCache.read(entry), value);
      const stored = JSON.parse(fs.readFileSync(entry, "utf8")) as {
        proof: { realpaths: Record<string, unknown> };
      };
      assert.equal(Object.hasOwn(stored.proof.realpaths, external), false);
      fs.writeFileSync(external, '{"value":"second"}\n', "utf8");
      assert.equal(PluginDescriptorEvaluationCache.read(entry), null);
    });
    check("same bytes/different native physical target", () => {
      const first = path.join(root, "first");
      const second = path.join(root, "second");
      const alias = path.join(root, "alias");
      for (const target of [first, second]) {
        fs.mkdirSync(target);
        fs.writeFileSync(path.join(target, "input.txt"), bytes, "utf8");
      }
      fs.symlinkSync(
        first,
        alias,
        process.platform === "win32" ? "junction" : "dir",
      );
      const linked = path.join(alias, "input.txt");
      const value = evaluation();
      value.inputs = [linked];
      value.hostInputHashes = { [linked]: digest(bytes) };
      value.hostInputRealpaths = { [linked]: fs.realpathSync.native(linked) };
      const entry = path.join(root, "physical.json");
      PluginDescriptorEvaluationCache.write(entry, value);
      assert.deepEqual(PluginDescriptorEvaluationCache.read(entry), value);
      fs.unlinkSync(alias);
      fs.symlinkSync(
        second,
        alias,
        process.platform === "win32" ? "junction" : "dir",
      );
      assert.equal(fs.readFileSync(linked, "utf8"), bytes);
      assert.notEqual(
        fs.realpathSync.native(linked),
        value.hostInputRealpaths[linked],
      );
      assert.equal(PluginDescriptorEvaluationCache.read(entry), null);
    });
    check("invalid/unreadable entry", () => {
      const entry = path.join(root, "invalid.json");
      assert.equal(PluginDescriptorEvaluationCache.read(entry), null);
      fs.writeFileSync(entry, "{not json", "utf8");
      assert.equal(PluginDescriptorEvaluationCache.read(entry), null);
      PluginDescriptorEvaluationCache.write(entry, evaluation());
      const stored = JSON.parse(fs.readFileSync(entry, "utf8")) as {
        format: string;
      };
      stored.format = "foreign-format";
      fs.writeFileSync(entry, JSON.stringify(stored), "utf8");
      assert.equal(PluginDescriptorEvaluationCache.read(entry), null);
      fs.rmSync(entry);
      fs.mkdirSync(entry);
      assert.equal(PluginDescriptorEvaluationCache.read(entry), null);
    });
    for (const shape of [
      "incomplete",
      "invalid hash",
      "invalid realpath",
      "empty proof",
    ])
      check(`read/${shape}`, () => {
        const entry = path.join(root, `${shape}.json`);
        PluginDescriptorEvaluationCache.write(entry, evaluation());
        const stored = JSON.parse(fs.readFileSync(entry, "utf8")) as {
          evaluation: { observationsComplete: boolean };
          proof: {
            hashes: Record<string, unknown>;
            realpaths: Record<string, unknown>;
          };
        };
        if (shape === "incomplete")
          stored.evaluation.observationsComplete = false;
        else if (shape === "invalid hash") stored.proof.hashes[input] = 42;
        else if (shape === "invalid realpath")
          stored.proof.realpaths[input] = 42;
        else stored.proof.hashes = {};
        fs.writeFileSync(entry, JSON.stringify(stored), "utf8");
        assert.equal(PluginDescriptorEvaluationCache.read(entry), null);
      });
  } catch (cause) {
    failures.push(new Error("fixture preparation", { cause }));
  } finally {
    try {
      fs.rmSync(root, { recursive: true, force: true });
    } catch (cause) {
      failures.push(new Error("fixture cleanup", { cause }));
    }
  }
  if (failures.length !== 0)
    throw new AggregateError(failures, "descriptor declaration/cache policy");
}
