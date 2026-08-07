import fs from "node:fs";
import path from "node:path";

import { EvidenceBenchmarkStageLog } from "./EvidenceBenchmarkStageLog";
import type { ITtscEvidenceBenchmarkGoalRecord } from "./structures/ITtscEvidenceBenchmarkGoalRecord";
import type { ITtscEvidenceBenchmarkTokenUsage } from "./structures/ITtscEvidenceBenchmarkTokenUsage";
import type { EvidenceBenchmarkArm } from "./typings/EvidenceBenchmarkArm";
import type { EvidenceBenchmarkEffort } from "./typings/EvidenceBenchmarkEffort";

/**
 * Composes and retains one review inspection performed outside the cell.
 *
 * The measured agent must never learn that it is being judged or by what
 * criteria, because a cell that knows the criteria can satisfy the criteria
 * instead of meeting them. The inspection therefore runs in its own native
 * thread, reads the retained stage log and the product, and returns a decision
 * the runner applies — never a sentence the cell can read.
 *
 * This namespace owns every byte the inspection writes under the run root. The
 * runner owns the process, exactly as it owns the measured app-server.
 */
export namespace EvidenceBenchmarkInspection {
  /** Directory holding every retained inspection artifact of a run. */
  export const DIRECTORY = "inspection";

  /**
   * Attempts permitted at one Review boundary before an operator must decide.
   *
   * A resumed run retries a failed inspection so a transient spawn failure or
   * timeout does not strand the cell, but each attempt is a full model run on
   * the cell's own model, so a persistently broken inspector must stop rather
   * than spend the account in a loop.
   */
  export const ATTEMPT_LIMIT = 3;

  /** Longest raw excerpt a retained failure message quotes inline. */
  const EXCERPT_CHARACTERS = 600;

  /** Prepared prompt, arguments, and retained artifact locations. */
  export interface IRequest {
    /** Objective sent on standard input rather than as an argument. */
    prompt: string;

    /** Native arguments placed after the resolved executable. */
    arguments: string[];

    /** Working root the inspecting thread is confined to. */
    cwd: string;

    /** Artifact name prefix relative to the run root. */
    prefix: string;

    /** File Codex writes its final message to. */
    messageFile: string;

    /** Stage log the inspection reads, relative to the run root. */
    stageLogRelativePath: string;
  }

  /** Decision bytes and measured cost of one completed inspection. */
  export interface IResult {
    /** Canonical verdict bytes retained and digested by supervision. */
    submitted: Buffer;

    /** Native token counters the inspecting thread reported. */
    tokenUsage: ITtscEvidenceBenchmarkTokenUsage;

    /** Native thread identifier, when the inspection reported one. */
    threadId?: string;
  }

  /**
   * Writes the prompt and response schema, and returns the invocation.
   *
   * The prompt quotes the exact instruction the attempt received, which the
   * Goal record already retains, so the inspection never reads the frozen
   * instruction tree and cannot drift from what the cell was actually told.
   */
  export function prepare(props: {
    runRoot: string;
    arm: EvidenceBenchmarkArm;
    pauseIndex: number;
    attempt: number;
    goal: ITtscEvidenceBenchmarkGoalRecord;
    model: string;
    effort: EvidenceBenchmarkEffort;
  }): IRequest {
    if (
      !Number.isSafeInteger(props.attempt) ||
      props.attempt < 1 ||
      props.attempt > ATTEMPT_LIMIT
    )
      throw new Error(
        `Review inspection attempt ${props.attempt} is outside the permitted ${ATTEMPT_LIMIT}.`,
      );
    const runRoot: string = path.resolve(props.runRoot);
    const directory: string = path.join(runRoot, DIRECTORY);
    fs.mkdirSync(directory, { recursive: true });
    // The attempt is part of the name so a retry cannot overwrite the evidence
    // of the attempt that failed before it.
    const prefix: string = `${String(props.pauseIndex).padStart(2, "0")}-${props.goal.name}-${props.attempt}`;
    const stageLog: string = EvidenceBenchmarkStageLog.resolve(
      runRoot,
      props.goal.name,
    );
    const promptFile: string = path.join(directory, `${prefix}.prompt.md`);
    const schemaFile: string = path.join(directory, `${prefix}.schema.json`);
    const messageFile: string = path.join(directory, `${prefix}.message.json`);
    const prompt: string = composePrompt({
      arm: props.arm,
      stageLogName: path.basename(stageLog),
      prescribedText: props.goal.prescribedText,
    });
    fs.writeFileSync(promptFile, prompt, "utf8");
    fs.writeFileSync(
      schemaFile,
      `${JSON.stringify(SCHEMA, null, 2)}\n`,
      "utf8",
    );
    fs.rmSync(messageFile, { force: true });
    return {
      prompt,
      arguments: [
        "exec",
        "--json",
        "--skip-git-repo-check",
        "--sandbox",
        "read-only",
        "--cd",
        runRoot,
        "--model",
        props.model,
        "--config",
        `model_reasoning_effort="${props.effort}"`,
        "--output-schema",
        schemaFile,
        "--output-last-message",
        messageFile,
        "-",
      ],
      cwd: runRoot,
      prefix,
      messageFile,
      stageLogRelativePath: path.basename(stageLog),
    };
  }

  /**
   * Retains the inspecting thread's streams and reads its decision and cost.
   *
   * Both are required. A decision the runner cannot price would put the cost of
   * judging back where it was before this existed: nowhere.
   */
  export function complete(props: {
    runRoot: string;
    request: IRequest;
    stdout: string;
    stderr: string;
    exitCode: number | null;
    signal: NodeJS.Signals | null;
  }): IResult {
    const directory: string = path.join(path.resolve(props.runRoot), DIRECTORY);
    fs.writeFileSync(
      path.join(directory, `${props.request.prefix}.jsonl`),
      props.stdout,
      "utf8",
    );
    fs.writeFileSync(
      path.join(directory, `${props.request.prefix}.stderr.log`),
      props.stderr,
      "utf8",
    );
    if (props.exitCode !== 0 || props.signal !== null)
      throw new Error(
        `Review inspection exited with code ${String(props.exitCode)} and signal ${String(props.signal)}.`,
      );
    const events: IInspectionEvents = readEvents(props.stdout);
    if (events.failure !== undefined)
      throw new Error(`Review inspection turn failed: ${events.failure}`);
    if (events.tokenUsage === undefined)
      throw new Error(
        `Review inspection reported no native token usage: expected a "turn.completed" event carrying "usage"; ${describe(events)}`,
      );
    if (!fs.existsSync(props.request.messageFile))
      throw new Error(
        `Review inspection wrote no final decision at ${props.request.messageFile}; ${describe(events)}`,
      );
    const decision: IDecision = parseDecision(
      fs.readFileSync(props.request.messageFile, "utf8"),
    );
    return {
      submitted: Buffer.from(
        `${JSON.stringify(
          { decision: decision.decision, rationale: decision.rationale },
          null,
          2,
        )}\n`,
        "utf8",
      ),
      tokenUsage: events.tokenUsage,
      ...(events.threadId === undefined ? {} : { threadId: events.threadId }),
    };
  }

  interface IDecision {
    decision: "pass" | "fail";
    rationale: string;
  }

  interface IInspectionEvents {
    tokenUsage?: ITtscEvidenceBenchmarkTokenUsage;
    threadId?: string;
    failure?: string;
    /** Distinct `type` values observed, in first-seen order. */
    types: string[];
    /** Non-empty lines read. */
    lines: number;
    /** Lines that were not JSON at all. */
    unparsed: number;
    /** First line that parsed but carried no recognized `type`. */
    unrecognized?: string;
  }

  const SCHEMA = {
    type: "object",
    additionalProperties: false,
    required: ["decision", "rationale"],
    properties: {
      decision: { type: "string", enum: ["pass", "fail"] },
      rationale: { type: "string" },
    },
  } as const;

  /**
   * Reads the exec event stream for the cost and outcome of the inspection.
   *
   * Codex emits one JSON object per line, and the fields read here are the ones
   * its `ThreadEvent` serialization names. Anything the inspection cannot
   * account for is a failure rather than a zero, so an unpriced judgement can
   * never reach a report as a free one.
   */
  function readEvents(stdout: string): IInspectionEvents {
    const result: IInspectionEvents = { types: [], lines: 0, unparsed: 0 };
    for (const line of stdout.split("\n")) {
      const text: string = line.trim();
      if (text.length === 0) continue;
      result.lines += 1;
      let value: unknown;
      try {
        value = JSON.parse(text);
      } catch {
        result.unparsed += 1;
        continue;
      }
      if (!isRecord(value)) {
        result.unparsed += 1;
        continue;
      }
      const type: string =
        typeof value.type === "string" ? value.type : "(no type)";
      if (!result.types.includes(type)) result.types.push(type);
      if (
        value.type === "thread.started" &&
        typeof value.thread_id === "string"
      )
        result.threadId = value.thread_id;
      else if (value.type === "turn.failed")
        result.failure = excerpt(JSON.stringify(value.error ?? value));
      else if (value.type === "turn.completed") {
        const usage: ITtscEvidenceBenchmarkTokenUsage = readUsage(
          value.usage,
          text,
        );
        result.tokenUsage =
          result.tokenUsage === undefined
            ? usage
            : addUsage(result.tokenUsage, usage);
      } else if (
        value.type !== "turn.started" &&
        value.type !== "item.started" &&
        value.type !== "item.updated" &&
        value.type !== "item.completed" &&
        result.unrecognized === undefined
      )
        result.unrecognized = excerpt(text);
    }
    return result;
  }

  /**
   * Says what the event stream actually contained.
   *
   * The event and field names this module expects were read off the Codex
   * binary rather than observed against a live run, so a rename must be
   * diagnosable from the retained failure alone. Naming the types that did
   * arrive turns "no token usage" into "`turn.finished` arrived where
   * `turn.completed` was expected". The complete stream stays on disk beside
   * the failure for everything the one-line excerpt cannot hold.
   */
  function describe(events: IInspectionEvents): string {
    return [
      `observed ${events.lines} line(s) with type(s) [${events.types.join(", ")}]`,
      events.unparsed === 0 ? "" : `, ${events.unparsed} unparsable`,
      events.unrecognized === undefined
        ? ""
        : `; first unrecognized line: ${events.unrecognized}`,
    ].join("");
  }

  function excerpt(text: string): string {
    return text.length <= EXCERPT_CHARACTERS
      ? text
      : `${text.slice(0, EXCERPT_CHARACTERS)}… (${text.length} characters)`;
  }

  /**
   * Reads one native usage report, naming every field that did not match.
   *
   * A missing counter is a failure rather than a zero. Zero would price the
   * inspection at nothing, which is exactly the accounting hole this thread
   * exists to close, so a mismatch is reported with the offending field names,
   * the keys the report did carry, and the raw line.
   */
  function readUsage(
    value: unknown,
    raw: string,
  ): ITtscEvidenceBenchmarkTokenUsage {
    if (!isRecord(value))
      throw new Error(
        `Review inspection "turn.completed" carries no "usage" object: ${excerpt(raw)}`,
      );
    const invalid: string[] = [];
    const read = (key: string): number => {
      const member: unknown = value[key];
      if (
        typeof member !== "number" ||
        !Number.isSafeInteger(member) ||
        member < 0
      ) {
        invalid.push(`${key}=${JSON.stringify(member) ?? "undefined"}`);
        return 0;
      }
      return member;
    };
    const inputTokens: number = read("input_tokens");
    const cachedInputTokens: number = read("cached_input_tokens");
    const cacheWriteInputTokens: number = read("cache_write_input_tokens");
    const outputTokens: number = read("output_tokens");
    const reasoningOutputTokens: number = read("reasoning_output_tokens");
    if (invalid.length !== 0)
      throw new Error(
        `Review inspection token usage is missing or invalid at ${invalid.join(", ")}; the report carried [${Object.keys(value).join(", ")}]: ${excerpt(raw)}`,
      );
    const total: unknown = value.total_tokens;
    return {
      // `total_tokens` is the one counter the runner can derive from the
      // others, so its absence is tolerated where a component's never is.
      totalTokens:
        typeof total === "number" && Number.isSafeInteger(total) && total >= 0
          ? total
          : inputTokens + outputTokens,
      inputTokens,
      cachedInputTokens,
      cacheWriteInputTokens,
      outputTokens,
      reasoningOutputTokens,
    };
  }

  function addUsage(
    left: ITtscEvidenceBenchmarkTokenUsage,
    right: ITtscEvidenceBenchmarkTokenUsage,
  ): ITtscEvidenceBenchmarkTokenUsage {
    return {
      totalTokens: left.totalTokens + right.totalTokens,
      inputTokens: left.inputTokens + right.inputTokens,
      cachedInputTokens: left.cachedInputTokens + right.cachedInputTokens,
      cacheWriteInputTokens:
        left.cacheWriteInputTokens + right.cacheWriteInputTokens,
      outputTokens: left.outputTokens + right.outputTokens,
      reasoningOutputTokens:
        left.reasoningOutputTokens + right.reasoningOutputTokens,
    };
  }

  function parseDecision(content: string): IDecision {
    const text: string = content.trim();
    let value: unknown;
    try {
      value = JSON.parse(text);
    } catch {
      throw new Error(
        `Review inspection produced no decision object: ${excerpt(text)}`,
      );
    }
    if (
      !isRecord(value) ||
      (value.decision !== "pass" && value.decision !== "fail") ||
      typeof value.rationale !== "string" ||
      value.rationale.trim().length === 0
    )
      throw new Error(
        `Review inspection decision needs "decision" of "pass" or "fail" and a non-empty "rationale": ${excerpt(text)}`,
      );
    return { decision: value.decision, rationale: value.rationale.trim() };
  }

  /**
   * Builds the objective the inspecting thread receives.
   *
   * It judges the questions its arm's review is answerable for and nothing
   * else, and `questions` owns which those are. Everything the inspection
   * notices beyond them is recorded in the rationale the operator reads, never
   * handed to the cell: a cell that corrects what it was told about has shown
   * it can act on a finding, not reach one.
   */
  function composePrompt(props: {
    arm: EvidenceBenchmarkArm;
    stageLogName: string;
    prescribedText: string;
  }): string {
    return [
      "# Inspect One Completed Attempt",
      "",
      "You are inspecting work someone else finished. Read only. Do not edit, create, move, or delete a file, do not run a command that writes, installs, or starts a server, and do not address the author. Your entire output is the final JSON decision described at the end.",
      "",
      "## What You May Read",
      "",
      `- \`${props.stageLogName}\` in the current directory: the exact session stream retained while the attempt ran, including every command it issued and every message it produced.`,
      "- `workspace/`: the product the attempt worked on, including its own instructions under `AGENTS.md` and `.agents/`.",
      "",
      "Read nothing else in the current directory. The session stream is long; read it in full rather than sampling it, because the question below is about what happened in it from end to end.",
      "",
      "## The Instruction The Attempt Received",
      "",
      quote(props.prescribedText),
      "",
      ...questions(props.arm),
      "",
      "Judge nothing else. Design taste, formatting, checklist bookkeeping, and commit hygiene are not your business. Where the product and the session stream disagree, the workspace is the evidence and the stream is the claim.",
      "",
      "## Decide",
      "",
      "Pass only when every question answers yes. Fail when any does not.",
      "",
      "Your final message must be exactly one JSON object with two properties and nothing around it:",
      "",
      '- `decision`: `"pass"` or `"fail"`.',
      "- `rationale`: why, citing the files, line numbers, and stream positions you relied on. State each fact you verified and mark anything you could not verify as unverified.",
      "",
      "The rationale is retained for the record. Nobody acts on its text, so write it for a reader who must be able to check your work, not for the author of the code.",
      "",
    ].join("\n");
  }

  /**
   * The questions one arm's review is judged on.
   *
   * They are not the same questions, because the two arms are not doing the
   * same work. A Plain review is a reading loop, so what can be checked is
   * whether the loop ran. An Evidence review inspects its own acknowledgements,
   * and the compiler has already proved that every citation resolves, so the
   * only thing left is whether each one is true: the graph can enforce that a
   * target resolves and not that the citing artifact delivers what the target
   * describes.
   *
   * Both arms are judged on their tests, because a suite that proves nothing is
   * the failure neither a reading loop nor a compiler can see.
   */
  function questions(arm: EvidenceBenchmarkArm): string[] {
    const tests: string =
      "**Are the tests properly written?** Judge the tests in the workspace against the workspace's own testing instructions. A suite that names one test for a hundred published operations, that asserts nothing, that asserts only that a call did not throw, or that pins the implementation's current output rather than the behavior it owes, is not properly written however green it runs.";
    if (arm === "plain")
      return [
        "## Judge Exactly Two Questions",
        "",
        "1. **Did the prescribed review loop run to dryness?** The instruction above requires rounds that continue until one round produces no finding and no edit. A loop ran to dryness only if the attempt read its full scope every round and ended on a round that read everything and changed nothing. It did not if the attempt substituted counts, summaries, searches, or a green command for reading; divided its scope across rounds instead of re-reading it; skipped the re-read after its last edit; or reported a dry round the session stream shows it never performed.",
        `2. ${tests}`,
      ];
    return [
      "## Judge Exactly Seven Questions",
      "",
      "The workspace carries `@evidence` and `@evidenceExclude` tags whose targets the compiler has already resolved. Resolution is not truth, and truth is what you are judging.",
      "",
      "1. **Does every hook cite the operations it calls?** Open the hook layer and the generated accessors it names, and confirm each citation names an operation that hook's own body reaches.",
      "2. **Does every screen use the hooks it cites, and render data serving the requirement it cites?** A page that mounts a hook and renders nothing from it, or whose cited requirement describes values the page discards, fails this.",
      "3. **Does every journey assert an observable outcome for each requirement it cites?** A journey that opens a screen, asserts a status code or a non-empty body, and never performs the action its cited requirement names, proves availability rather than behavior.",
      "4. **Is every `@evidenceExclude` a reviewed non-applicability decision?** It must name what owns the target instead and a condition that would make the decision false. An exclusion standing in for work this layer owes is the one outcome the graph exists to prevent, and it looks exactly like a passing build.",
      "5. **Does every citation name only targets whose subtree the host owns?** A parent target acknowledges every selected descendant, so citing one is truthful only when the host owns the whole subtree, and a citation reaching past what the host delivers discharges obligations nobody met.",
      "6. **Does any `@todo` remain under the workspace source?** The backend stages a rule that fails the build on one; the frontend has only a sweep the author runs and reports, so a stub shipped as done survives every gate the workspace has.",
      `7. ${tests}`,
    ];
  }

  function quote(text: string): string {
    const lines: string[] = text.split(/\r\n|\n|\r/u);
    if (lines.at(-1) === "") lines.pop();
    return lines.map((line) => `> ${line}`).join("\n");
  }

  function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
  }
}
