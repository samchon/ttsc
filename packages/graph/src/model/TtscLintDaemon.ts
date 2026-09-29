import { type ChildProcessWithoutNullStreams, spawn } from "node:child_process";
import readline from "node:readline";

/**
 * One plugin sidecar this daemon can be opened against.
 *
 * @evidence contracts/common.md#principled-implementation Binary, plugin manifest and optional project context identify the sidecar executable and configuration inputs for its verbs.
 * @evidence contracts/common.md#clear-and-simple-design The target groups only launch identity while cwd and tsconfig remain session-owned coordinates.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Plugin configuration is passed through its supported manifest/context flags rather than patched into a running foreign process.
 * @evidence contracts/common.md#meaningful-documentation Native member comments explain binary identity and the two configuration channels.
 * @evidenceExclude contracts/performance.md#efficient-algorithms A launch target describes identity without selecting a transport-processing strategy.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work The session and ask own sidecar reuse; this descriptor only supplies its identity inputs.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The target acquires no child or reader and owns no process lifetime.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation The target shape contains native coordinates but invokes no process; ask owns its spawn boundary.
 */
export interface ITtscLintDaemonTarget {
  /** Native plugin sidecar executable path. */
  binary: string;

  /** Serialized plugin manifest consumed by the sidecar. */
  manifest: string;

  /** Optional serialized project identity passed to context-aware rules. */
  projectContext?: string;
}

/**
 * A resident `@ttsc/lint` sidecar, kept open across the questions one graph
 * session asks it.
 *
 * The alternative is what this replaces: a process per question. Publishing a
 * project's artifacts asks two — `graph-nodes` and `project-inputs` — and a
 * resident graph session asks both again every time a document moves, so the
 * spawn, the plugin load, and the configuration evaluation were paid once per
 * edit, forever. `@ttsc/lint` already runs `lsp-serve` for exactly this reason,
 * and `ttscserver` already routes its own read verbs through it.
 *
 * Everything here degrades rather than fails. A sidecar built before these
 * verbs joined the daemon rejects them, an older one does not know `lsp-serve`
 * at all, and a daemon can die mid-session; each of those closes this one and
 * leaves the caller to spawn per verb, which is the behaviour that existed
 * before this and is still correct — only slower.
 *
 * @evidence contracts/common.md#principled-implementation Serialized line requests match FIFO responses; unsupported or failed daemon replies return null so callers can use the same direct verb contract.
 * @evidence contracts/common.md#clear-and-simple-design This owner isolates one sidecar's transport, pending replies and failure state from artifact publication semantics.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts A failed daemon is retired rather than advertised as a successful empty artifact set.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs explain resident amortization and the supported direct-command fallback rather than claiming all failures are empty results.
 * @evidenceExclude contracts/performance.md#efficient-algorithms ask owns queue/transport processing with send/start/onLine helpers; the declaration describes their state.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work ask owns continued process/configuration reuse and invalidation.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources ask and close own acquisition, failure and shutdown transitions; the declaration adds no independent lifecycle operation.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation Native invocation and termination decisions are acknowledged on ask and close together with private helpers.
 */
export class TtscLintDaemon {
  private child: ChildProcessWithoutNullStreams | undefined;
  private lines: readline.Interface | undefined;
  private readonly pending: ((reply: IReply | null) => void)[] = [];
  private queue: Promise<unknown> = Promise.resolve();
  private failed = false;

  public constructor(
    private readonly target: ITtscLintDaemonTarget,
    private readonly cwd: string,
    private readonly tsconfig: string,
  ) {}

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
   * @evidence contracts/portability.md#os-neutral-implementation spawn passes executable and an argv vector directly with windowsHide, preserving spaces and native executable semantics without shell quoting.
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
   * @evidence contracts/portability.md#os-neutral-implementation Node stream closure and child.kill own native termination rather than platform shell commands.
   */
  public close(): void {
    this.failed = true;
    for (const settle of this.pending.splice(0)) settle(null);
    this.lines?.close();
    this.lines = undefined;
    const child = this.child;
    this.child = undefined;
    if (child === undefined) return;
    child.stdin.end();
    child.kill();
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
      child.stdin.write(
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

  private start(): ChildProcessWithoutNullStreams | undefined {
    if (this.child !== undefined) return this.child;
    if (this.failed) return undefined;
    let child: ChildProcessWithoutNullStreams;
    try {
      child = spawn(
        this.target.binary,
        [
          "lsp-serve",
          `--cwd=${this.cwd}`,
          `--tsconfig=${this.tsconfig}`,
          `--plugins-json=${this.target.manifest}`,
          ...(this.target.projectContext === undefined
            ? []
            : [`--project-context-json=${this.target.projectContext}`]),
        ],
        { cwd: this.cwd, stdio: ["pipe", "pipe", "pipe"], windowsHide: true },
      );
    } catch {
      this.failed = true;
      return undefined;
    }
    this.child = child;
    // The sidecar's stderr is its own diagnostic channel and is not this
    // client's to interpret; draining it keeps a chatty plugin from filling the
    // pipe and stalling the daemon it is talking through.
    child.stderr.resume();
    child.on("error", () => this.fail());
    child.on("exit", () => this.fail());
    this.lines = readline.createInterface({ input: child.stdout });
    this.lines.on("line", (line) => this.onLine(line));
    return child;
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
