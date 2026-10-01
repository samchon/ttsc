import { FixtureFiles } from "../../internal/FixtureFiles";
import fs from "node:fs";
import path from "node:path";
import { stripVTControlCharacters } from "node:util";

import {
  assertExcludes,
  assertFailure,
  assertIncludes,
  assertStatus,
  createProject,
  runCheck,
  withEvidenceProject,
} from "../../internal/evidence/internal/index";

/**
 * Verifies per-claim and per-reference severity reaches the real compiler.
 *
 * Typed undefined values must survive config validation as inheritance, while
 * warnings must reach the CLI without failing its exit status. Off populations
 * must not load, even if their sources do not exist.
 *
 * 1. Run an error rule with a warning claim and an undefined reference level.
 * 2. Override that reference to error and then off.
 * 3. Disable the claim with an error reference and restore undefined inheritance.
 *
 * @evidence contracts/testing.md#behavioral-verification Checks warning inheritance, reference error, reference off, claim off and restored outer-error inheritance across five real checks.
 * @evidence contracts/testing.md#independent-expectations Authored severity values independently prescribe warning status 0 versus error failure; ANSI-stripped warning TS/error TS prefixes distinguish rendering.
 * @evidence contracts/testing.md#distinguishing-cases Undefined values under exactOptionalPropertyTypes must inherit; disabled populations name missing globs without loading them. The off-claim case does not separately require output silence.
 * @evidence contracts/testing.md#execution-ownership The test_evidence_graph_severity_controls_exit_status export is discovered by test-e2e src/index.ts under src/features and selected as a function by tests/test-e2e/evidence.config.json. This E2E entry runs the real ttsc check against its linked consumer and owns the assertions in this function; helper callbacks run through this entry and are reviewed with its body rather than selected as independent cases.
 * @evidence contracts/e2e.md#necessary-boundary Typed severity options and native diagnostics must connect to actual CLI exit codes; inheritance calculations themselves are direct-unit candidates.
 * @evidence contracts/e2e.md#shared-execution One consumer/config generator and native cache serve five fresh hosts; the sequential assertions currently prevent later variants running after an earlier failure. The explicitly selected authored lint snapshot is the same producer used by the file-rule batch; changed fixture inputs do not copy or rebuild that package.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Only lint.config.ts changes between completed hosts; finally invokes strict fixture cleanup with bounded retries. withEvidenceProject invokes cleanup after every operation, preserving a single thrown value unchanged or both operation and removal failures in AggregateError.
 * @evidence contracts/e2e.md#preserved-coverage All five verdicts, warning/error text, missing finding and reference-off absence stay here; no claim is made that independent rule arithmetic needs five native lifetimes.
 */
export const test_evidence_graph_severity_controls_exit_status = (): void => {
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
  const project = createProject({
    nativeProducer: "snapshot",
    name: "severity-controls-exit-status",
    compilerOptions: { exactOptionalPropertyTypes: true },
    lintConfig: config('"warning"', "undefined"),
    files: FixtureFiles.read("evidence/evidence_graph_severity_controls_exit_status/inputs-1"),
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
  withEvidenceProject(project, () => {
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
  });
};
