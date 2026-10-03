import type { TraceMeasurements } from "./readE2eTraceMeasurements";

/**
 * Actual named invocation and its observed result, never assertion coverage.
 * @evidence contracts/common.md#principled-implementation Keeps validated writer/invocation/sequence and actual callable or scenario identity, with an absent result left absent.
 * @evidence contracts/common.md#clear-and-simple-design Distinguishes file/export tests from label/name profiles without inventing a shared source-address grammar.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Outcome metadata does not declare assertion coverage, process counts or resource closure.
 * @evidence contracts/common.md#meaningful-documentation Fields retain observed identity and ordered result positions for independent mapping by the caller.
 */
export interface InvocationObservation {
  readonly writerFile: string;
  readonly invocation: string;
  readonly kind: "test" | "profile";
  readonly name: string;
  readonly file?: string;
  readonly label?: string;
  readonly sequence: number;
  resultSequence?: number;
  outcome?: "returned" | "skipped" | "threw";
}

/**
 * Missing or conflicting observations remain explicit instead of expected totals.
 * @evidence contracts/common.md#principled-implementation Separates actual invocation records from pairing problems and explicitly limits the result to observations.
 * @evidence contracts/common.md#clear-and-simple-design One records list and one problem list retain successful, skipped, failed and incomplete evidence without collapsing it to a coverage count.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The false certification field prevents treating this shape as proof of expected assertion or callback population.
 * @evidence contracts/common.md#meaningful-documentation Defines invocation-level observation rather than total native or survivor coverage.
 */
export interface InvocationOutcomes {
  readonly observedOnly: true;
  readonly assertionCoverageCertified: false;
  readonly invocations: InvocationObservation[];
  readonly problems: string[];
}

/**
 * Pairs actual test/profile admission and result rows from the retained phase.
 * File/export identity comes only from TestExecutor's actual imported callable;
 * profile label/name comes from its actual scenario owner, without guessing a
 * source address from a label or manufacturing an absent callback result.
 *
 * @evidence contracts/common.md#principled-implementation Exact writer-file/invocation identity and ordered start/result rows connect actual callable observations. Duplicate, unmatched, changed identity and missing terminal results remain problems; returned false is skipped rather than coverage.
 * @evidence contracts/common.md#clear-and-simple-design One map pairs four marker kinds independently from native process and Program counters. The output retains source or scenario identity with actual sequence positions.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts No required population or result is synthesized; profile labels are not converted to source addresses and a returned marker never certifies assertions, children, Programs or descendants.
 * @evidence contracts/common.md#meaningful-documentation States actual identity provenance and the limits of invocation-level observation, separate from selected assertion mapping and native measurement completeness.
 * @evidence contracts/performance.md#efficient-algorithms Visits retained rows once and indexes each named invocation; text comparisons scale with recorded names and paths.
 * @evidence contracts/performance.md#reuse-equivalent-work Reuses already validated phase metadata without rereading files or payloads; it never reuses a callback outcome for a different invocation.
 * @evidence contracts/performance.md#bound-retention-and-release-resources Retains one small record per observed named invocation and each pairing problem. It opens no handle; trace retention and actual runner/child joins remain the coordinator's responsibility.
 */
export function pairE2eInvocationOutcomes(measurements: TraceMeasurements | undefined): InvocationOutcomes {
  const output: InvocationOutcomes = {
    observedOnly: true, assertionCoverageCertified: false, invocations: [], problems: [],
  };
  if (!measurements) {
    output.problems.push("Missing phase trace observations");
    return output;
  }
  const active = new Map<string, InvocationObservation>();
  for (const row of measurements.writerObservations) {
    const event = row.observation;
    const kind = event.event.startsWith("test-") ? "test" : "profile";
    if (event.event !== "test-invocation" && event.event !== "test-result" &&
      event.event !== "profile-invocation" && event.event !== "profile-result") continue;
    const identity = kind === "test" ? event.data?.file : event.data?.label;
    const name = event.data?.name;
    if (typeof identity !== "string" || identity.length === 0 || typeof name !== "string" || name.length === 0) {
      output.problems.push("Malformed named invocation identity: " + row.writerFile + ":" + event.sequence);
      continue;
    }
    const key = row.writerFile + ":" + event.invocation;
    if (event.event.endsWith("-invocation")) {
      if (active.has(key)) {
        output.problems.push("Duplicate named invocation: " + key);
        continue;
      }
      const record: InvocationObservation = {
        writerFile: row.writerFile, invocation: event.invocation, kind, name,
        ...(kind === "test" ? { file: identity } : { label: identity }), sequence: event.sequence,
      };
      active.set(key, record);
      output.invocations.push(record);
    } else {
      const record = active.get(key);
      if (!record || record.kind !== kind || record.name !== name ||
        (kind === "test" ? record.file : record.label) !== identity ||
        record.resultSequence !== undefined || event.sequence <= record.sequence) {
        output.problems.push("Unmatched or conflicting named result: " + key);
        continue;
      }
      const outcome = event.data?.outcome;
      if ((outcome !== "returned" && outcome !== "skipped" && outcome !== "threw") ||
        (kind === "profile" && outcome === "skipped")) {
        output.problems.push("Invalid named result outcome: " + key);
        continue;
      }
      record.resultSequence = event.sequence;
      record.outcome = outcome;
    }
  }
  for (const record of output.invocations)
    if (record.resultSequence === undefined)
      output.problems.push("Missing named invocation result: " + record.writerFile + ":" + record.invocation);
  return output;
}
