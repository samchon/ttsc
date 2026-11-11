import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { RuntimeInputContents } from "../../../../../packages/ttsc/src/compiler/internal/build/RuntimeInputContents";
import { RuntimeInputProof } from "../../../../../packages/ttsc/src/compiler/internal/build/RuntimeInputProof";
import type { ITtscCompilerTransformation } from "../../../../../packages/ttsc/src/structures/ITtscCompilerTransformation";

/**
 * Verifies a stored result is proven by replaying the compiler's own filesystem
 * observations, and that each kind of input change moves exactly one answer.
 *
 * Replaying the answers replaces asking the compiler again, so it has to notice
 * what the compiler would: an edit, an added root, a candidate that appears
 * ahead of the resolved one, and a removed file (samchon/ttsc#1852).
 *
 * 1. Author a small tree and the observations a compiler would record for it.
 * 2. Replay them unchanged, then after each single change, restoring it after.
 * 3. Assert the replay holds, or names the path whose answer moved.
 *
 * @evidence contracts/testing.md#behavioral-verification The production replay runs over real files with a real content session; each change is made on disk and the returned path is the observable verdict.
 * @evidence contracts/testing.md#independent-expectations The observations are authored from the tree itself with Node's SHA-256 and native realpath, and each expectation is the one path the test just changed.
 * @evidence contracts/testing.md#distinguishing-cases An unchanged tree, an edited source, a file added to an enumerated directory, an absent candidate created, a removed source, a byte-order mark that leaves compiler text unchanged, and a change inside the producer's private output separate the predicate kinds and the one exclusion.
 * @evidence contracts/testing.md#execution-ownership The unit runner discovers this named export and calls maintained owners over an owned temporary tree; no compiler, native host or installed package runs, and finally removes the tree.
 */
export function test_runtimeinputproof_replays_every_compiler_observation(): void {
  const root = fs.realpathSync.native(
    fs.mkdtempSync(path.join(os.tmpdir(), "ttsx-replay-")),
  );
  try {
    const source = path.join(root, "src");
    const emit = path.join(root, "emit");
    const main = path.join(source, "main.ts");
    const helper = path.join(source, "helper.tsx");
    const candidate = path.join(source, "helper.ts");
    const produced = path.join(emit, "main.js");
    fs.mkdirSync(source);
    fs.mkdirSync(emit);
    fs.writeFileSync(main, 'import "./helper";\n');
    fs.writeFileSync(helper, "export const helper = 1;\n");
    fs.writeFileSync(produced, "compiled");
    const text = (file: string): string =>
      crypto
        .createHash("sha256")
        .update(fs.readFileSync(file, "utf8"))
        .digest("hex");
    const observations: Record<
      string,
      ITtscCompilerTransformation.IInputObservation
    > = {
      [source]: {
        directoryExists: true,
        accessibleEntries: {
          directories: [],
          files: ["helper.tsx", "main.ts"],
        },
        realpath: { ok: true, path: source },
      },
      [main]: {
        readFile: { ok: true, hash: text(main) },
        realpath: { ok: true, path: main },
      },
      [helper]: {
        fileExists: true,
        readFile: { ok: true, hash: text(helper) },
        realpath: { ok: true, path: helper },
      },
      [candidate]: { fileExists: false },
      [path.join(root, "package.json")]: { readFile: { ok: false } },
      // The producer's own private output is never an input.
      [produced]: { fileExists: false },
    };
    const replay = (): string | undefined => {
      const contents = RuntimeInputContents.open(
        path.join(root, "tsconfig.json"),
        undefined,
        RuntimeInputProof.textCodec,
      );
      try {
        return RuntimeInputProof.replay(observations, emit, contents);
      } finally {
        contents.close();
      }
    };
    const failures: Error[] = [];
    const expect = (
      label: string,
      moved: string | undefined,
      change: () => void,
      restore: () => void,
    ): void => {
      change();
      try {
        assert.equal(replay(), moved, label);
      } catch (cause) {
        failures.push(new Error(label, { cause }));
      } finally {
        restore();
      }
    };
    const original = fs.readFileSync(main);
    const nothing = (): void => {};

    expect("unchanged tree", undefined, nothing, nothing);
    expect(
      "edited source",
      main,
      () => fs.writeFileSync(main, 'import "./helper"; // edited\n'),
      () => fs.writeFileSync(main, original),
    );
    // The compiler hashes the text it decodes, so a byte-order mark alone
    // leaves its answer unchanged.
    expect(
      "byte-order mark",
      undefined,
      () =>
        fs.writeFileSync(
          main,
          Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), original]),
        ),
      () => fs.writeFileSync(main, original),
    );
    const added = path.join(source, "added.ts");
    expect(
      "file added to an enumerated directory",
      source,
      () => fs.writeFileSync(added, "export {};\n"),
      () => fs.unlinkSync(added),
    );
    expect(
      "absent candidate created",
      source,
      () => fs.writeFileSync(candidate, "export const helper = 2;\n"),
      () => fs.unlinkSync(candidate),
    );
    const moved = path.join(root, "helper.moved");
    expect(
      "removed source",
      source,
      () => fs.renameSync(helper, moved),
      () => fs.renameSync(moved, helper),
    );
    expect(
      "manifest created where a read failed",
      path.join(root, "package.json"),
      () => fs.writeFileSync(path.join(root, "package.json"), "{}"),
      () => fs.unlinkSync(path.join(root, "package.json")),
    );
    expect(
      "change inside the private output",
      undefined,
      () => fs.writeFileSync(produced, "another run"),
      nothing,
    );
    // Without its directory's listing, each file's own predicate answers.
    delete observations[source];
    expect(
      "absent candidate created, unenumerated",
      candidate,
      () => fs.writeFileSync(candidate, "export const helper = 2;\n"),
      () => fs.unlinkSync(candidate),
    );
    expect(
      "removed source, unenumerated",
      helper,
      () => fs.renameSync(helper, moved),
      () => fs.renameSync(moved, helper),
    );
    if (failures.length)
      throw new AggregateError(failures, "compiler observation replay");
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}
