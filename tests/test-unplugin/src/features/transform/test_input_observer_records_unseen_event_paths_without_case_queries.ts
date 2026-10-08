import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { createInputObserver } from "../../../../../packages/unplugin/src/core/observer/createInputObserver";
import { captureWatchInputBaseline } from "../../../../../packages/unplugin/src/core/transform/watch/captureWatchInputBaseline";
import { TestProject } from "../../../../utils/src/TestProject";

/**
 * Verifies event intake records uncertain names without native case queries.
 *
 * Events in newly created directories need candidate history, not filesystem
 * identity authority. Explicit case providers count synchronous intake queries;
 * actual file conditions decide whether the later batch reports an owner.
 *
 * 1. Contrast sensitive and insensitive registration policies with content and
 *    rename waves in previously unseen directories, requiring quiet unchanged
 *    inputs and no intake case queries.
 * 2. Change content, replace an ancestor and create an absent input, notifying
 *    through uncertain names and requiring only the affected owner to reload.
 * 3. Register stale recorded bytes after an event, then reanchor to polling and
 *    dispose; require race replay, current polling and inert retired
 *    callbacks.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls actual createInputObserver with supported watch, poll and case-provider seams over real files. Counts queries within synchronous event callbacks and asserts actual owner reports after unchanged, changed, missing, raced and polled conditions.
 * @evidence contracts/testing.md#independent-expectations No native namespace query is needed to retain notification candidates. Literal file contents and their independently hashed recorded bytes define changed conditions; literal owner arrays require unchanged siblings to stay quiet. No elapsed performance threshold or observer key implementation supplies the oracle.
 * @evidence contracts/testing.md#distinguishing-cases Both advertised case policies cross content and rename events, existing and missing event suffixes, differently cased and unrelated names. Ancestor replacement, absent-input appearance, compile-to-subscribe replay, native-to-poll reanchoring and stale callbacks after disposal retain meaningful state boundaries. Native unknown-case identity, physical links, membership and yielding waves retain their complementary owning units.
 * @evidence contracts/testing.md#execution-ownership This discoverable authored-source unit owns four independent observer lifetimes and real temporary files. Injected watch/poll callbacks start no native watcher, compiler, host or native build. Finally disposal cancels pending waves; TestProject owns fixture cleanup.
 */
export async function test_input_observer_records_unseen_event_paths_without_case_queries(): Promise<void> {
  for (const sensitive of [true, false]) {
    for (const eventType of ["change", "rename"]) {
      const root = TestProject.createProject({
        "source/Input.ts": "before",
        "stable.ts": "stable",
        "raced.ts": "recorded",
      });
      const file = path.join(root, "source/Input.ts");
      const stable = path.join(root, "stable.ts");
      const missing = path.join(root, "Missing.ts");
      const raced = path.join(root, "raced.ts");
      const owner = path.join(root, "owner");
      const stableOwner = path.join(root, "stable-owner");
      const missingOwner = path.join(root, "missing-owner");
      const racedOwner = path.join(root, "raced-owner");
      const reports: string[][] = [];
      let queries = 0;
      let emit!: (event: string, file: string | null) => void;
      let poll!: () => void;
      const observer = createInputObserver(
        ({ reload, invalidate }) => {
          assert.equal(invalidate.size, 0);
          reports.push([...reload].sort());
        },
        {
          caseSensitive: () => {
            ++queries;
            return sensitive;
          },
          poll: (listener) => {
            poll = listener;
            return { close: () => undefined };
          },
          watch: (_root, listener) => {
            emit = listener;
            return { close: () => undefined };
          },
        },
      );
      const notify = (file: string | null): void => {
        const before = queries;
        emit(eventType, file);
        assert.equal(queries, before, "intake must not query case policy");
      };
      const settled = async (): Promise<string[][]> => {
        await new Promise((resolve) => setTimeout(resolve, 30));
        return reports.splice(0);
      };
      try {
        observer.open(root, false);
        observer.replace(owner, [{ file }]);
        observer.replace(stableOwner, [{ file: stable }]);
        assert.ok(queries > 0, "registration still obtains case authority");
        assert.deepEqual(await settled(), []);
        for (let i = 0; i < 8; ++i) {
          const directory = path.join(root, `new-${i}`);
          fs.mkdirSync(directory);
          notify(path.join(directory, "unrelated.tmp"));
          notify(path.join(directory, "missing/suffix.tmp"));
        }
        assert.deepEqual(await settled(), [], "unrelated unchanged wave");

        fs.writeFileSync(file, "changed");
        notify(path.join(root, "source/INPUT.TS"));
        assert.deepEqual(await settled(), [[owner]]);
        observer.replace(owner, [{ file }]);
        fs.renameSync(path.dirname(file), path.join(root, "moved"));
        fs.mkdirSync(path.dirname(file));
        fs.writeFileSync(file, "replaced ancestor");
        notify(path.dirname(file));
        assert.deepEqual(await settled(), [[owner]]);

        observer.replace(missingOwner, [{ file: missing }]);
        fs.writeFileSync(missing, "appeared");
        notify(path.join(root, "MISSING.TS"));
        assert.deepEqual(await settled(), [[missingOwner]]);

        const baseline = captureWatchInputBaseline(raced);
        assert.ok(baseline);
        const startedAt = observer.begin();
        fs.writeFileSync(raced, "after compile");
        notify(path.join(root, "RACED.TS"));
        observer.replace(
          racedOwner,
          [
            {
              file: raced,
              evidence: {
                identity: baseline.identity,
                missing: false,
                state: {
                  codec: "host",
                  hash: createHash("sha256").update("recorded").digest("hex"),
                },
              },
            },
          ],
          false,
          startedAt,
        );
        assert.deepEqual(await settled(), [[racedOwner]], "raced proof replay");

        observer.replace(owner, [{ file }]);
        const retired = emit;
        observer.open(root, true);
        const before = queries;
        retired("rename", path.join(root, "retired/new/event.tmp"));
        assert.equal(queries, before);
        fs.writeFileSync(file, "polled");
        poll();
        assert.deepEqual(await settled(), [[owner]], "polling retains proof");
        await observer.dispose();
        const disposedQueries = queries;
        retired("change", path.join(root, "disposed/new/event.tmp"));
        poll();
        assert.equal(queries, disposedQueries);
        assert.deepEqual(await settled(), [], "retired callbacks stay inert");
      } finally {
        await observer.dispose();
      }
    }
  }
}
