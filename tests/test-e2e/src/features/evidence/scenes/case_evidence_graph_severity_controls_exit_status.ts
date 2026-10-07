import fs from "node:fs";
import path from "node:path";
import { stripVTControlCharacters } from "node:util";

import { FixtureFiles } from "../../../internal/FixtureFiles";
import { TransitionProject } from "../../../internal/evidence/internal/TransitionProject";
import {
  type ITtscEvidenceProject,
  assertExcludes,
  assertFailure,
  assertIncludes,
  assertStatus,
  runCheck,
} from "../../../internal/evidence/internal/index";

/**
 * Verifies per-claim and per-reference severity reaches the real compiler.
 *
 * Typed undefined values must survive config validation as inheritance, while
 * warnings must reach the CLI without failing its exit status. Disabled
 * populations with missing sources must not cause these checks to fail; this
 * case does not independently count loader invocations.
 *
 * 1. Run an error rule with a warning claim and an undefined reference level.
 * 2. Override that reference to error and then off.
 * 3. Disable the claim with an error reference and restore undefined inheritance.
 *
 * @evidence contracts/testing.md#behavioral-verification Checks warning inheritance, reference error, reference off, claim off and restored outer-error inheritance across five real checks.
 * @evidence contracts/testing.md#independent-expectations Authored severity values independently prescribe warning status 0 versus error failure; ANSI-stripped warning TS/error TS prefixes distinguish rendering.
 * @evidence contracts/testing.md#distinguishing-cases Undefined values under exactOptionalPropertyTypes must inherit; disabled populations name missing globs but the checks remain successful. Loader invocation counts are not observed, and the off-claim case does not separately require output silence.
 * @evidence contracts/testing.md#execution-ownership Called by test_e2e_evidence, which is discovered under src/features and selected by tests/test-e2e/evidence.config.json; this scenario is an exported case function selected by the same claim and runs the real ttsc check against the shared linked consumer.
 * @evidence contracts/e2e.md#necessary-boundary Typed severity options and native diagnostics must connect to actual CLI exit codes; inheritance calculations themselves are direct-unit candidates.
 * @evidence contracts/e2e.md#shared-execution Runs in the experiment's single linked consumer and selected native cache; five separate CLI invocations remain because each severity combination is a distinct configuration the CLI reads per invocation. This is not a count of all native children or Program constructors, nor proof of a cache hit.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Entering resets only src, docs and the two config files; only lint.config.ts changes after each synchronous check returns. That return does not certify arbitrary descendant shutdown. The experiment releases the consumer after the last of its four scenarios.
 * @evidence contracts/e2e.md#preserved-coverage All five verdicts, warning/error text, missing finding and reference-off absence stay here.
 */
export function case_evidence_graph_severity_controls_exit_status(
  project: ITtscEvidenceProject,
): void {
  const config = (
    claim: string,
    reference: string,
    files = "docs/spec.md",
  ): string => `
import type { ITtscLintConfig } from "@ttsc/lint";
import { evidence, type ITtscEvidenceGraphConfig } from "@ttsc/evidence";
const graph: ITtscEvidenceGraphConfig = {
  claims: [{
    type: "typescript", files: ["src/**"], symbol: "type",
    severity: ${claim},
    reference: { type: "markdown", files: ["${files}"], symbol: "h2", severity: ${reference} },
  }],
};
export default {
  plugins: { evidence },
  rules: { "evidence/graph": ["error", graph] },
} satisfies ITtscLintConfig;
`;
  TransitionProject.enter(project, {
    compilerOptions: { exactOptionalPropertyTypes: true },
    lintConfig: config('"warning"', "undefined"),
    files: FixtureFiles.read("evidence/transitions/severity"),
  });
  const check = (claim: string, reference: string, files?: string) => {
    fs.writeFileSync(
      path.join(project.directory, "lint.config.ts"),
      config(claim, reference, files),
      "utf8",
    );
    const result = runCheck(project.directory);
    return { ...result, output: stripVTControlCharacters(result.output) };
  };
  const warning = check('"warning"', "undefined");
  assertStatus(warning, 0, "An inherited warning must not fail the command.");
  assertIncludes(warning, "warning TS", "The CLI must print a warning.");
  assertIncludes(
    warning,
    "Missing acknowledgement",
    "The warning must carry the graph finding.",
  );
  const error = check('"warning"', '"error"');
  assertFailure(error, "An error reference must override its warning claim.");
  assertIncludes(error, "error TS", "The CLI must print an error.");
  const offReference = check('"error"', '"off"', "missing/**/*.md");
  assertStatus(
    offReference,
    0,
    "An off reference must not load missing evidence.",
  );
  assertExcludes(
    offReference,
    "[evidence/graph]",
    "An off reference must remain silent.",
  );
  const offClaim = check('"off"', '"error"', "missing/**/*.md");
  assertStatus(
    offClaim,
    0,
    "An off claim must suppress even an error reference.",
  );
  const inherited = check("undefined", "undefined");
  assertFailure(
    inherited,
    "Undefined at both levels must inherit the outer error.",
  );
  assertIncludes(
    inherited,
    "Missing acknowledgement",
    "Restoring inheritance must re-enable coverage.",
  );
}
