import fs from "node:fs";
import path from "node:path";

import type { ITtscEvidenceBenchmarkInstructionPlanEntry } from "./structures/ITtscEvidenceBenchmarkInstructionPlanEntry";
import type { EvidenceBenchmarkArm } from "./typings/EvidenceBenchmarkArm";
import type { EvidenceBenchmarkReviewScope } from "./typings/EvidenceBenchmarkReviewScope";

/** Owns frozen and dynamically supplemented benchmark objective text. */
export namespace EvidenceBenchmarkInstruction {
  export const GOAL_OBJECTIVE_MAX_CHARACTERS = 4_000;

  /** Opens an operator warning that replaces an Evidence continuation. */
  export const OPERATOR_WARNING_HEADING = "# Correct This Before Continuing";

  /**
   * Supplementation attempts a Plain review scope may take before it fails.
   *
   * The bound exists so a cell that cannot reach the bar terminates instead of
   * looping, and the attempt it stops on is itself the measurement.
   *
   * It is four because a cell that answers a reminder answers the first one.
   * The `todo` Plain cell of the first `0.6.0` cohort spent all eight: its
   * first supplementation ran 346 commands and changed 9 files, and the seven
   * after it ran 8 commands between them and changed nothing, the last
   * executing no command at all. Attempts past the point of movement measure
   * nothing and are charged at full inspection price.
   */
  export const REVIEW_SUPPLEMENT_LIMIT = 4;

  /** Returns the frozen base sequence. Plain reminders are adaptive, not base. */
  export function entries(
    arm: EvidenceBenchmarkArm,
  ): readonly (readonly [string, string])[] {
    if (arm === "evidence")
      return [
        ["backend-start", "evidence/backend/start.md"],
        ["backend-review", "evidence/backend/review.md"],
        ["backend-final", "evidence/backend/final.md"],
        ["frontend-start", "evidence/frontend/start.md"],
        ["frontend-review", "evidence/frontend/review.md"],
        ["frontend-final", "evidence/frontend/final.md"],
        ["overall-review", "evidence/overall/review.md"],
        ["overall-final", "evidence/overall/final.md"],
      ];
    return [
      ["backend-start", "plain/backend/start.md"],
      ["backend-review", "plain/backend/review.md"],
      ["backend-final", "plain/backend/final.md"],
      ["frontend-start", "plain/frontend/start.md"],
      ["frontend-review", "plain/frontend/review.md"],
      ["frontend-final", "plain/frontend/final.md"],
      ["overall-review", "plain/overall/review.md"],
      ["overall-final", "plain/overall/final.md"],
    ];
  }

  /** Creates the retained base plan before any verdict inserts a supplement. */
  export function plan(
    arm: EvidenceBenchmarkArm,
  ): ITtscEvidenceBenchmarkInstructionPlanEntry[] {
    return entries(arm).map(([name, relativePath]) => ({
      name,
      relativePath,
      kind: "base",
    }));
  }

  /** Reconstructs the fixed sequence retained runs used before adaptive review. */
  export function legacyPlan(
    arm: EvidenceBenchmarkArm,
  ): ITtscEvidenceBenchmarkInstructionPlanEntry[] {
    const entries: readonly (readonly [string, string])[] =
      arm === "evidence"
        ? EvidenceBenchmarkInstruction.entries(arm)
        : [
            ["backend-start", "plain/backend/start.md"],
            ["backend-review", "plain/backend/review.md"],
            ["backend-remind", "plain/backend/remind.md"],
            ["backend-final", "plain/backend/final.md"],
            ["frontend-start", "plain/frontend/start.md"],
            ["frontend-review", "plain/frontend/review.md"],
            ["frontend-remind", "plain/frontend/remind.md"],
            ["frontend-final", "plain/frontend/final.md"],
            ["overall-review", "plain/overall/review.md"],
            ["overall-remind", "plain/overall/remind.md"],
            ["overall-final", "plain/overall/final.md"],
          ];
    return entries.map(([name, relativePath]) => ({
      name,
      relativePath,
      kind: "legacy-base",
    }));
  }

  /** Returns the arm-owned continuation appended to every objective. */
  export function continuationPath(arm: EvidenceBenchmarkArm): string {
    return `${arm}/continue.md`;
  }

  /** Reads and validates one exact base or supplemented Goal objective. */
  export function objective(props: {
    arm: EvidenceBenchmarkArm;
    instructionsRoot: string;
    entry: Pick<
      ITtscEvidenceBenchmarkInstructionPlanEntry,
      "relativePath" | "reviewFeedback"
    >;
  }): {
    prescribedText: string;
    continuationText: string;
    objectiveText: string;
  } {
    const prescribedText: string = readPrescribedText(props);
    // An Evidence objective carries an operator warning in place of the
    // continuation rather than after it. `thread/goal/set` is the runner's only
    // channel into the thread, and substitution keeps the objective within the
    // Codex ceiling however long the warning runs — `backend/start` once
    // expanded to 3923 of the 4000 accepted characters, where appending could
    // not fit. The warning states the same continuation duty in its own words,
    // which is why substituting it loses nothing.
    const warned: boolean =
      props.entry.reviewFeedback !== undefined &&
      !isPlainSupplement(props.entry.relativePath);
    const continuationText: string = warned
      ? `${OPERATOR_WARNING_HEADING}\n\n${props.entry.reviewFeedback!.trim()}`
      : fs.readFileSync(
          path.join(
            props.instructionsRoot,
            ...continuationPath(props.arm).split("/"),
          ),
          "utf8",
        );
    const objectiveText: string = `${prescribedText}\n\n${continuationText}`;
    if (objectiveText.length > GOAL_OBJECTIVE_MAX_CHARACTERS)
      throw new Error(
        `${props.entry.relativePath} expands to ${objectiveText.length} Goal characters; Codex accepts at most ${GOAL_OBJECTIVE_MAX_CHARACTERS}.`,
      );
    return { prescribedText, continuationText, objectiveText };
  }

  /** Identifies a base Review or dynamic supplementation verdict boundary. */
  export function reviewBoundary(
    entry: ITtscEvidenceBenchmarkInstructionPlanEntry,
  ): { scope: EvidenceBenchmarkReviewScope; attempt: number } | undefined {
    if (entry.kind === "review-supplement") {
      if (
        entry.reviewScope === undefined ||
        entry.reviewAttempt === undefined ||
        entry.reviewAttempt < 1 ||
        entry.reviewAttempt > REVIEW_SUPPLEMENT_LIMIT
      )
        throw new Error("Review supplementation plan entry is incomplete.");
      return { scope: entry.reviewScope, attempt: entry.reviewAttempt };
    }
    if (entry.kind !== "base") return undefined;
    const match = /^(backend|frontend|overall)-review$/u.exec(entry.name);
    return match === null
      ? undefined
      : {
          scope: match[1] as EvidenceBenchmarkReviewScope,
          attempt: 0,
        };
  }

  function readPrescribedText(props: {
    arm: EvidenceBenchmarkArm;
    instructionsRoot: string;
    entry: Pick<
      ITtscEvidenceBenchmarkInstructionPlanEntry,
      "relativePath" | "reviewFeedback"
    >;
  }): string {
    const prescribedText: string = fs.readFileSync(
      path.join(props.instructionsRoot, ...props.entry.relativePath.split("/")),
      "utf8",
    );
    if (
      !props.entry.relativePath.startsWith("plain/") ||
      !/\/(?:remind|final)\.md$/u.test(props.entry.relativePath)
    ) {
      return prescribedText;
    }
    const reviewPath: string = props.entry.relativePath.replace(
      /\/(?:remind|final)\.md$/u,
      "/review.md",
    );
    const reviewText: string = fs.readFileSync(
      path.join(props.instructionsRoot, ...reviewPath.split("/")),
      "utf8",
    );
    const separator: string = prescribedText.endsWith("\n") ? "\n" : "\n\n";
    const feedback: string =
      props.entry.reviewFeedback === undefined
        ? ""
        : `Correct these verified gaps:\n\n${props.entry.reviewFeedback.trim()}\n\n`;
    return `${prescribedText}${separator}${feedback}${quoteMarkdown(reviewText)}`;
  }

  /** Reports whether an entry is a Plain reminder, which quotes its Review. */
  function isPlainSupplement(relativePath: string): boolean {
    return (
      relativePath.startsWith("plain/") &&
      /\/(?:remind|final)\.md$/u.test(relativePath)
    );
  }

  function quoteMarkdown(text: string): string {
    const lines: string[] = text.split(/\r\n|\n|\r/u);
    if (lines.at(-1) === "") lines.pop();
    return lines.map((line) => `> ${line}`).join("\n");
  }
}
