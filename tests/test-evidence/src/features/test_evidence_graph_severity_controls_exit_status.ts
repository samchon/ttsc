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
} from "../internal/index";

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
    name: "severity-controls-exit-status",
    compilerOptions: { exactOptionalPropertyTypes: true },
    lintConfig: config('"warning"', "undefined"),
    files: {
      "src/contract.ts": "export interface IContract {}\n",
      "docs/spec.md": "## Requirement {#requirement}\n",
    },
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
  try {
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
  } finally {
    project.cleanup();
  }
};
