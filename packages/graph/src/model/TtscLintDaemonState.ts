import { TtscGraphLinePeer } from "./TtscGraphLinePeer";

/**
 * FIFO reply correlation and direct-command fallback for one lint daemon.
 *
 * Replies have no request id, so admission is serialized. Null means the
 * resident protocol cannot answer; callers retain their direct verb fallback.
 *
 * @evidence contracts/common.md#principled-implementation Serialized requests and FIFO replies preserve the sidecar protocol; failed and unsupported answers permanently retire this owner.
 * @evidence contracts/common.md#clear-and-simple-design Line parsing and queue/failure transitions are local; the declared opener owns actual process transport.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Null requests a real direct fallback, never an invented empty result or fake success.
 * @evidence contracts/common.md#meaningful-documentation Prose explains no-id serialization and the null fallback contract; ask and close document acquisition and retirement.
 * @evidenceExclude contracts/performance.md#efficient-algorithms ask/close own admission, frame processing and retirement; this declaration groups their retained state.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work ask/close establish continued peer/model reuse, not the class descriptor independently.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources ask/close control acquisition and release; the class declaration adds no separate lifecycle transition.
 */
export class TtscLintDaemonState {
  private child: TtscGraphLinePeer.Connection | undefined;
  private readonly pending: ((reply: IReply | null) => void)[] = [];
  private queue: Promise<unknown> = Promise.resolve();
  private failed = false;

  public constructor(private readonly open: (events: TtscGraphLinePeer.Events) => TtscGraphLinePeer.Connection) {}

  /**
   * Ask one verb and return its raw JSON, or `null` when this daemon cannot
   * answer it.
   *
   * `null` is always "ask the sidecar directly instead", never "the project has
   * none". The two are indistinguishable downstream — an empty artifact set is
   * the correct answer for most projects — so a daemon that cannot answer must
   * never be allowed to look like one that answered nothing.
   *
   * Requests are serialized. The daemon answers one line per request in order,
   * with nothing in the reply to address it by, so a second request in flight
   * would be matched against the first one's answer.
   *
   * @evidence contracts/common.md#principled-implementation A promise queue admits one request at a time because the protocol orders responses without request ids; result text preserves arbitrary JSON values.
   * @evidence contracts/common.md#clear-and-simple-design ask owns queue admission while send/start/onLine own transport and reply decoding.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Null explicitly requests a direct fallback; it cannot silently masquerade as no published artifacts.
   * @evidence contracts/common.md#meaningful-documentation Native paragraphs explain null meaning and why requests must be serialized.
   * @evidence contracts/performance.md#efficient-algorithms Each request writes and decodes one JSON frame; queue work is linear in serialized frame bytes with one active reply.
   * @evidence contracts/performance.md#reuse-equivalent-work The same target/project sidecar retains process, plugin load and configuration across verbs; invalidate explicitly retires warm Program facts when input generations change.
   * @evidence contracts/performance.md#bound-retention-and-release-resources The daemon owns one child and reader; close settles pending replies and kills the child, while queued promises remain proportional to submitted caller demand.
   */
  public ask(verb: string, invalidate: boolean): Promise<string | null> {
    const run = this.queue.then(() => this.send(verb, invalidate));
    this.queue = run.catch(() => undefined);
    return run;
  }

  /**
   * Stop the sidecar. Safe to call more than once, and after a failure.
   *
   * Pending replies settle null so callers can switch to the direct command.
   *
   * @evidence contracts/common.md#principled-implementation Marking failed before settling requests prevents new daemon work while reader and child ownership are cleared.
   * @evidence contracts/common.md#clear-and-simple-design One shutdown operation is shared by explicit disposal and transport failure.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Shutdown does not invent a successful reply to unblock a request.
   * @evidence contracts/common.md#meaningful-documentation Native prose states idempotence, failure safety and the meaning of settled null replies.
   * @evidence contracts/performance.md#efficient-algorithms Closing visits outstanding reply callbacks once and clears the reader/child references.
   * @evidence contracts/performance.md#reuse-equivalent-work Closure retires this target's reusable process permanently; later calls return the supported direct-fallback indication.
   * @evidence contracts/performance.md#bound-retention-and-release-resources Both normal and failed shutdown settle pending callbacks, close readline and end/kill the owned process; already absent children require no further release.
   */
  public close(): void {
    this.failed = true;
    for (const settle of this.pending.splice(0)) settle(null);
    const child = this.child;
    this.child = undefined;
    if (child === undefined) return;
    child.close(true);
  }

  private async send(
    verb: string,
    invalidate: boolean,
  ): Promise<string | null> {
    if (this.failed) return null;
    const child = this.start();
    if (child === undefined) return null;
    const reply = await new Promise<IReply | null>((resolve) => {
      this.pending.push(resolve);
      child.write(
        `${JSON.stringify({ invalidate, verb })}\n`,
        (error) => {
          if (error === null || error === undefined) return;
          this.fail();
        },
      );
    });
    if (reply === null || reply.code !== 0) {
      // A nonzero code is the sidecar declining, and this client cannot tell
      // "unknown verb" from "the rule failed". Closing rather than retrying
      // through the daemon is what makes the caller fall back to the direct
      // command, where a real failure surfaces the same way it always did.
      this.close();
      return null;
    }
    return reply.result;
  }

  private start(): TtscGraphLinePeer.Connection | undefined {
    if (this.child !== undefined) return this.child;
    if (this.failed) return undefined;
    try {
      this.child = this.open({
        line: (line) => this.onLine(line),
        error: () => this.fail(),
        exit: () => this.fail(),
      });
      return this.child;
    } catch {
      this.failed = true;
      return undefined;
    }
  }

  private onLine(line: string): void {
    const settle = this.pending.shift();
    if (settle === undefined) return;
    let reply: IReply;
    try {
      reply = JSON.parse(line) as IReply;
    } catch {
      settle(null);
      return;
    }
    settle(
      typeof reply.code === "number"
        ? { code: reply.code, result: rawResult(line) }
        : null,
    );
  }

  private fail(): void {
    this.close();
  }
}

/** One `lsp-serve` reply: a verb result and the code that qualifies it. */
interface IReply {
  code: number;
  result: string;
}

/**
 * The `result` member, as the JSON text this daemon's callers parse.
 *
 * A verb's result is arbitrary JSON that the caller decodes itself, so it is
 * handed back as text rather than as a value — which is what the direct command
 * hands over, and what keeps the two paths interchangeable. The text is
 * re-serialized rather than sliced out of the line: the bytes are not identical
 * to the sidecar's own, but the value they decode to is, and no caller here
 * reads anything else.
 *
 * A reply with no `result` is `"null"`, so a caller parses a value either way
 * instead of being handed the empty string.
 */
function rawResult(line: string): string {
  const parsed = JSON.parse(line) as { result?: unknown };
  return parsed.result === undefined ? "null" : JSON.stringify(parsed.result);
}
