import type { IRunResult } from "./IRunResult";

/** One obligation `evidence/graph` reported as unacknowledged. */
export interface IMissingAcknowledgement {
  /** Evidence unit address the reference selected and nothing cited. */
  readonly target: string;

  /** Configured claim name that owes the acknowledgement. */
  readonly claim: string;

  /** One-based index of the reference within that claim. */
  readonly reference: number;
}

const OPENING = "Missing acknowledgement for '";
const JOIN = " in Claim ";

/**
 * Reads the obligations a lint run actually demanded.
 *
 * This is the observation an empty population cannot produce. A reference that
 * selects nothing has nothing to demand, so it reports full coverage while
 * checking nothing — the exact state that voided a measurement cohort when a
 * `package` reference enumerated a pnpm workspace link and came back empty.
 * Every case here therefore asserts on the units this returns rather than on an
 * exit status, because a claim that goes quiet when enabled produces the same
 * clean exit as a claim that is satisfied.
 *
 * The message is parsed positionally rather than by one regular expression: the
 * readable middle segment carries a source location and a declaration name, and
 * either can contain the punctuation a pattern would have to anchor on.
 */
export const readMissingAcknowledgements = (
  result: IRunResult,
): IMissingAcknowledgement[] => {
  const found: IMissingAcknowledgement[] = [];
  const text: string = result.output;
  let cursor: number = 0;
  for (;;) {
    const opened: number = text.indexOf(OPENING, cursor);
    if (opened === -1) return found;
    const from: number = opened + OPENING.length;
    const closed: number = text.indexOf("'", from);
    cursor = from;
    if (closed === -1) continue;
    // Bounded so a malformed message cannot borrow the claim label of a later
    // one and report an obligation against a claim that never owed it. The
    // readable segment between them carries a declaration name and a source
    // location, which is long but not unbounded.
    const window: string = text.slice(closed, closed + 600);
    const offset: number = window.indexOf(JOIN);
    if (offset === -1) continue;
    const joined: number = closed + offset;
    const parsed: RegExpExecArray | null =
      /^ in Claim \d+ \('([^']+)'\) reference (\d+) \(/.exec(
        text.slice(joined, joined + 200),
      );
    if (parsed?.[1] === undefined || parsed[2] === undefined) continue;
    found.push({
      target: text.slice(from, closed),
      claim: parsed[1],
      reference: Number(parsed[2]),
    });
  }
};

/**
 * Reads every population the graph reported as selecting no source at all.
 *
 * A reference that matched no files is the loud half of the same failure the
 * quiet half hides: both mean the obligation materialized nothing, and only one
 * of them says so. Cases assert this list is empty for the claim they just
 * enabled, so a gate that opens onto an empty population fails instead of
 * passing vacuously.
 *
 * Empty is the word, not unreadable. A population that failed to load is
 * suppressed here on purpose — the graph reports the read failure at its own
 * cause and withholds the derived empty-match line — so this list holds
 * healthy-and-empty populations only, and a read failure arrives below.
 *
 * Only a reference reaches this list. A claim that selects nothing deactivates
 * without a word, and one whose declared root is broken is reported against the
 * root rather than against the claim, because a root is shared and carries no
 * claim label. Both of those land on the second half of
 * {@link assertClaimActivated} instead, where a claim that owes nothing is the
 * failure — which is why that half exists rather than being a nicety.
 */
export const readEmptyPopulationReports = (result: IRunResult): string[] =>
  result.output
    .split("\n")
    .filter((line) => line.includes("matched no "))
    .map((line) => line.trim());
