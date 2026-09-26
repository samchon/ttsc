import type { TtscGenerationProofFailures } from "./TtscGenerationProofFailures";

/**
 * Whether an attempt failed only because it reported dependency paths it had no
 * witness for (samchon/ttsc#1541).
 *
 * Such an attempt learned its dependencies too late to witness them, which says
 * nothing about the project moving, so it is retried with them witnessed
 * without spending the bound a moving project spends. A dropped witness beyond
 * the failure bound could be anything, so it counts as a move.
 *
 * @param failures The attempt's recorded proof failures.
 */
export function onlyUnwitnessedDependencies(
  failures: TtscGenerationProofFailures,
): boolean {
  return (
    failures.omitted === 0 &&
    failures.entries.length !== 0 &&
    failures.entries.every(
      (failure) =>
        failure.domain === "external" &&
        failure.kind === "dependency-unwitnessed",
    )
  );
}
