import type { ITtscProjectMembershipPolicy } from "./ITtscProjectMembershipPolicy";

/**
 * Whether a membership policy matches root specs case-sensitively.
 *
 * The compiler's own answer, reported by its envelope, decides
 * (samchon/ttsc#1545). TypeScript-Go takes it from the filesystem its
 * executable lives on: always insensitive on Windows, and elsewhere sensitive
 * unless the executable is found again under its case-swapped name. A policy no
 * compile has reported for yet takes what that probe answers on the platform's
 * ordinary filesystem, sensitive on Linux and insensitive on macOS and Windows.
 * That answer only primes the first walk: the capture adopts the reported
 * policy, and a walk taken under another one is retried
 * (`captureTransformGeneration`).
 *
 * @param policy The membership policy.
 */
export function policyUsesCaseSensitiveFileNames(
  policy: ITtscProjectMembershipPolicy,
): boolean {
  return policy.useCaseSensitiveFileNames ?? process.platform === "linux";
}
