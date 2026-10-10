import fs from "node:fs";
import path from "node:path";

/**
 * Observes the native source's first producer publication in its private trace.
 * The caller owns the trace root and actual child-close Promise. A terminal
 * producer failure rejects immediately; pending work has no elapsed deadline.
 * This observes the initial saved corpus, never an arbitrary editor refresh.
 *
 * @evidence contracts/common.md#principled-implementation The initial generation terminal event is emitted by NativePluginSource only after actual run/decode/store handling; exact cwd and producer admission exclude other processes and producers. Successful-empty publication remains observable for the caller's completion assertion.
 * @evidence contracts/common.md#clear-and-simple-design One helper joins the existing private trace with the caller-owned close outcome without adding a product request or duplicating native preparation.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Actual producer terminal state supplies readiness; no diagnostic, trigger notice, elapsed interval or request retry substitutes for it.
 * @evidence contracts/common.md#meaningful-documentation The prose states first-generation scope, root/close ownership, failure behavior and absence of a positive deadline.
 * @evidence contracts/portability.md#os-neutral-implementation Node native watch/read/path operations observe the supplied existing directory. Exact source cwd spelling comes from the same launcher input; no filesystem alias or case equivalence is inferred.
 * @evidence contracts/performance.md#efficient-algorithms The watcher scans complete JSONL records on actual directory events, with work proportional to retained trace bytes per event. The private writer has a byte budget; this helper keeps no accumulated record history.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work The helper replays the same already-produced initial event for later consumers; it never starts or repeats discovery.
 * @evidence contracts/performance.md#bound-retention-and-release-resources Each pending observation owns one watcher, closed after publication, trace error or actual child close. Its close continuation remains attached to the caller's existing lifetime; no child or trace directory ownership transfers.
 */
export namespace LspCompletionPublication {
  /**
   * Wait for generation one's terminal producer result, rejecting actual native
   * failure, trace corruption or child close without that observation.
   *
   * @evidence contracts/common.md#principled-implementation Registering the watcher before replaying complete newline-delimited records covers publication both before and after admission. Only schema-one matching producer/cwd/generation events end the wait; publication errors and actual close stay distinct from absence.
   * @evidence contracts/common.md#clear-and-simple-design One scan and one terminal settle operation share watcher cleanup; no clock or repeated LSP request is involved.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts The producer's published result supplies readiness, including empty success; real run/decode failures reject instead of being caught and retried.
   * @evidence contracts/common.md#meaningful-documentation Documents first-generation scope and each failure authority; source comments explain replay ordering and partial append handling.
   * @evidence contracts/portability.md#os-neutral-implementation Native realpath supplies one physical directory for watching and reads, avoiding DOS 8.3 versus long-name watcher disagreement. Protocol cwd retains exact source spelling; no OS label or shell parsing supplies identity.
   * @evidence contracts/performance.md#efficient-algorithms Scans only JSONL files and complete lines. Work and transient strings scale with private trace bytes per event; no payload files, compiler inputs or corpus contents are read.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work Replaying existing producer evidence starts no computation and does not cache a mutable refresh result.
   * @evidence contracts/performance.md#bound-retention-and-release-resources A single watcher closes exactly once at settlement, including read/watch failure and child close. The child-close continuation remains until its already-owned lifetime ends; no process, timer or retained directory is acquired.
   */
  export function wait(
    root: string,
    cwd: string,
    producer: string,
    closed: Promise<unknown>,
  ): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      let settled = false;
      let watcher: fs.FSWatcher | undefined;
      let directory = root;
      const settle = (error?: unknown) => {
        if (settled) return;
        settled = true;
        watcher?.close();
        if (error === undefined) resolve();
        else reject(error);
      };
      const scan = () => {
        if (settled) return;
        try {
          for (const file of fs.readdirSync(directory)) {
            if (!file.endsWith(".jsonl")) continue;
            const text = fs.readFileSync(path.join(directory, file), "utf8");
            // A writer may still own the final partial append. A newline is
            // the authority that its JSON record is complete.
            for (const line of text.slice(0, text.lastIndexOf("\n") + 1).split("\n")) {
              if (!line) continue;
              const event = JSON.parse(line);
              if (event.event === "integrity-failure")
                throw new Error("LSP publication trace integrity failure");
              if (
                event.schema !== 1 ||
                event.event !== "lsp-hints-publication" ||
                event.cwd !== cwd ||
                event.data?.producer !== producer ||
                event.data?.generation !== 1
              ) continue;
              if (event.data.outcome !== "published")
                throw new Error(
                  `Initial ${producer} completion publication ${event.data.outcome}: ${event.data.error ?? "no error detail"}`,
                );
              settle();
              return;
            }
          }
        } catch (error) {
          settle(error);
        }
      };
      try {
        // Node's Windows watcher requires its registered directory to agree
        // with the physical names returned by native events. A DOS 8.3 temp
        // parent can otherwise abort the entire process before JS can catch
        // anything (#1717). Pin only private trace storage, never protocol cwd.
        directory = fs.realpathSync.native(root);
        watcher = fs.watch(directory, scan);
        watcher.on("error", settle);
        scan();
      } catch (error) {
        settle(error);
      }
      void closed.then(
        () => {
          scan();
          if (!settled) settle(new Error("ttscserver closed before initial completion publication"));
        },
        (error) => settle(new Error("ttscserver close observation failed", { cause: error })),
      );
    });
  }
}
