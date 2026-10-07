import type { ITtscLintDaemonTarget } from "./ITtscLintDaemonTarget";
import { TtscGraphLinePeer } from "./TtscGraphLinePeer";
import { TtscGraphNativeArguments } from "./TtscGraphNativeArguments";
import { TtscLintDaemonState } from "./TtscLintDaemonState";

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
 * @evidence contracts/common.md#clear-and-simple-design This facade owns one sidecar's launch identity; daemon state owns FIFO replies/fallback and the shared line adapter owns its native transport.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts A failed daemon is retired rather than advertised as a successful empty artifact set.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs explain resident amortization and the supported direct-command fallback rather than claiming all failures are empty results.
 * @evidenceExclude contracts/performance.md#efficient-algorithms ask delegates FIFO processing and fallback to daemon state; this declaration describes the real sidecar launch identity.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work ask owns continued process/configuration reuse and invalidation.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources ask and close own acquisition, failure and shutdown transitions; the declaration adds no independent lifecycle operation.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation Native invocation and termination decisions are acknowledged on ask and close together with private helpers.
 */
export class TtscLintDaemon {
  private readonly state: TtscLintDaemonState;

  public constructor(
    private readonly target: ITtscLintDaemonTarget,
    private readonly cwd: string,
    private readonly tsconfig: string,
  ) {
    this.state = new TtscLintDaemonState((events) =>
      TtscGraphLinePeer.open(
        this.target.binary,
        TtscGraphNativeArguments.lint(
          this.cwd,
          this.tsconfig,
          this.target.manifest,
          this.target.projectContext,
        ),
        events,
        { cwd: this.cwd, stderr: "drain" },
      ),
    );
  }

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
   * @evidence contracts/common.md#clear-and-simple-design ask delegates queue admission and reply decoding to daemon state; its configured opener supplies actual native transport and supported sidecar argv.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Null explicitly requests a direct fallback; it cannot silently masquerade as no published artifacts.
   * @evidence contracts/common.md#meaningful-documentation Native paragraphs explain null meaning and why requests must be serialized.
   * @evidence contracts/performance.md#efficient-algorithms Each request writes and decodes one JSON frame; queue work is linear in serialized frame bytes with one active reply.
   * @evidence contracts/performance.md#reuse-equivalent-work The same target/project sidecar retains process, plugin load and configuration across verbs; invalidate explicitly retires warm Program facts when input generations change.
   * @evidence contracts/performance.md#bound-retention-and-release-resources The daemon owns one child and reader; close settles pending replies and kills the child, while queued promises remain proportional to submitted caller demand.
   * @evidence contracts/portability.md#os-neutral-implementation spawn passes executable and an argv vector directly with windowsHide, preserving spaces and native executable semantics without shell quoting.
   */
  public ask(verb: string, invalidate: boolean): Promise<string | null> {
    return this.state.ask(verb, invalidate);
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
   * @evidence contracts/performance.md#bound-retention-and-release-resources Both normal and failed shutdown settle pending callbacks, close readline and end/kill the owned process; the returned completion still joins stdio after process exit and rejects unknown or forced termination.
   * @evidence contracts/portability.md#os-neutral-implementation Node stream closure and child.kill own native termination rather than platform shell commands.
   */
  public close(): Promise<void> {
    return this.state.close();
  }
}
