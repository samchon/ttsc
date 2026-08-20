import { type ChildProcessWithoutNullStreams, spawn } from "node:child_process";
import readline from "node:readline";

/** One plugin sidecar this daemon can be opened against. */
export interface ITtscLintDaemonTarget {
  binary: string;
  manifest: string;
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
   */
  public ask(verb: string, invalidate: boolean): Promise<string | null> {
    const run = this.queue.then(() => this.send(verb, invalidate));
    this.queue = run.catch(() => undefined);
    return run;
  }

  /** Stop the sidecar. Safe to call more than once, and after a failure. */
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
