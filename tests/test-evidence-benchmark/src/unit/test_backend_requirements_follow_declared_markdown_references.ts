import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { assertRequirementsReached } from "../internal/assertRequirementsReached";
import { BenchmarkClaimReferences } from "../internal/BenchmarkClaimReferences";
import type { IMissingAcknowledgement } from "../internal/evidenceDiagnostics";

/**
 * Verifies declared Markdown references require complete delivered documents.
 *
 * An empty Markdown diagnostic population must not exempt its declared edge.
 * Literal single and array references decide applicability before observations;
 * adjacent Prisma-only and TypeScript-only claims remain legitimate controls.
 *
 * 1. Parse named single/array claims and supply two section documents.
 * 2. Accept complete observations and reject zero, partial and foreign targets.
 * 3. Distinguish non-Markdown and independent Markdown edges and ambiguous input.
 * 4. Read the unchanged frozen backend configurations as actual parser inputs.
 *
 * @evidence contracts/testing.md#behavioral-verification Actual configuration syntax reading and requirement comparison accept complete Markdown coverage and reject zero/partial/foreign observations, an unexpected Markdown edge, missing/duplicate/computed/spread declarations, empty delivered sections and duplicate basenames.
 * @evidence contracts/testing.md#independent-expectations Literal named claim reference kinds, two authored section documents and explicit obligation indices define exact applicability and completeness; unchanged frozen API/backend configurations provide real supported syntax inputs.
 * @evidence contracts/testing.md#distinguishing-cases Single Markdown, mixed arrays, two separate Markdown edges and Prisma/TypeScript-only controls prevent observed diagnostics from deciding the expected kind. Zero, partial, foreign, wrong-index and empty-section negatives contrast complete populations.
 * @evidence contracts/testing.md#execution-ownership The matching src/unit export calls authored parser/comparison owners against ordinary fixture filesystem bytes and read-only frozen configurations, without evaluating a descriptor, building a producer, installing a consumer or starting a benchmark cell; finally removes its exact root.
 */
export function test_backend_requirements_follow_declared_markdown_references(): void {
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), "ttsc-backend-references-unit-"),
  );
  try {
    const analysis = path.join(root, "docs", "analysis");
    fs.mkdirSync(analysis, { recursive: true });
    fs.writeFileSync(path.join(analysis, "first.md"), "## First\n");
    fs.writeFileSync(path.join(analysis, "second.md"), "### Second\n");
    fs.writeFileSync(
      path.join(analysis, "no-section.md"),
      "```md\n## Only fenced\n```\n",
    );
    const configuration = path.join(root, "lint.config.ts");
    const write = (claims: string): void => {
      fs.writeFileSync(
        configuration,
        `export const graph = { claims: [${claims}] };`,
      );
    };
    const declaration = (name: string, references: string): string =>
      `{ name: '${name}', type: 'typescript', reference: ${references} }`;
    const markdown = "{ type: 'markdown' }";
    const prisma = "{ type: 'prisma' }";
    const typescript = "{ type: 'typescript' }";
    write(
      [
        declaration("single", markdown),
        declaration("mixed", `[${markdown}, ${prisma}]`),
        declaration("prisma", prisma),
        declaration("typescript", typescript),
        declaration("twice", `[${markdown}, ${markdown}]`),
      ].join(","),
    );
    const obligations = (
      claim: string,
      reference = 1,
    ): IMissingAcknowledgement[] =>
      ["first.md", "second.md"].map((file) => ({
        claim,
        reference,
        target: `../../docs/analysis/${file}#section`,
      }));
    assert.deepEqual(BenchmarkClaimReferences.read(configuration, "single"), [
      "markdown",
    ]);
    assert.deepEqual(BenchmarkClaimReferences.read(configuration, "mixed"), [
      "markdown",
      "prisma",
    ]);
    assertRequirementsReached(root, configuration, "single", obligations("single"));
    assertRequirementsReached(root, configuration, "mixed", obligations("mixed"));
    assert.throws(
      () => assertRequirementsReached(root, configuration, "single", []),
      /first.md.*second.md/,
    );
    assert.throws(
      () =>
        assertRequirementsReached(
          root,
          configuration,
          "mixed",
          obligations("mixed").slice(0, 1),
        ),
      /second.md/,
    );
    assert.throws(
      () =>
        assertRequirementsReached(root, configuration, "single", [
          ...obligations("single"),
          { claim: "single", reference: 1, target: "foreign.md#section" },
        ]),
      /not a delivered/,
    );
    assert.throws(
      () =>
        assertRequirementsReached(root, configuration, "single", [
          { claim: "single", reference: 1, target: "not-first.md#section" },
        ]),
      /not a delivered/,
    );
    assertRequirementsReached(root, configuration, "prisma", []);
    assertRequirementsReached(root, configuration, "typescript", []);
    assert.throws(
      () =>
        assertRequirementsReached(
          root,
          configuration,
          "prisma",
          obligations("prisma"),
        ),
      /without declaring/,
    );
    assert.throws(
      () =>
        assertRequirementsReached(
          root,
          configuration,
          "mixed",
          obligations("mixed", 2),
        ),
      /without declaring/,
    );
    assert.throws(
      () =>
        assertRequirementsReached(
          root,
          configuration,
          "twice",
          obligations("twice"),
        ),
      /reference 2/,
    );
    assertRequirementsReached(root, configuration, "twice", [
      ...obligations("twice"),
      ...obligations("twice", 2),
    ]);
    assert.throws(
      () => BenchmarkClaimReferences.read(configuration, "missing"),
      /found 0/,
    );
    for (const invalid of [
      `${declaration("single", markdown)}, ${declaration("single", prisma)}`,
      "{ name: 'single', reference: selectedReference }",
      "{ name: 'single', reference: { type: selectedType } }",
      "{ name: 'single', ...other, reference: { type: 'markdown' } }",
      "{ name: 'single', reference: { [kind]: 'markdown' } }",
      "{ name: 'single', reference: [] }",
      `${declaration("single", markdown)}, { name: selectedName, reference: ${prisma} }`,
    ]) {
      write(invalid);
      assert.throws(() => BenchmarkClaimReferences.read(configuration, "single"));
    }
    write(declaration("single", markdown));
    fs.mkdirSync(path.join(analysis, "nested"));
    fs.writeFileSync(path.join(analysis, "nested", "first.md"), "## Duplicate\n");
    assert.throws(
      () =>
        assertRequirementsReached(
          root,
          configuration,
          "single",
          obligations("single"),
        ),
      /ambiguous duplicate/,
    );
    write(declaration("prisma", prisma));
    assertRequirementsReached(root, configuration, "prisma", []);
    write(declaration("single", markdown));
    fs.rmSync(path.join(analysis, "nested"), { recursive: true });
    fs.writeFileSync(path.join(analysis, "first.md"), "No section\n");
    fs.writeFileSync(path.join(analysis, "second.md"), "No section\n");
    assert.throws(
      () => assertRequirementsReached(root, configuration, "single", []),
      /no delivered requirement document/,
    );
    const template = path.resolve(
      __dirname,
      "../../../../benchmarks/evidence/template/evidence/packages",
    );
    const api = path.join(template, "api", "lint.config.ts");
    const backend = path.join(template, "backend", "test", "lint.config.ts");
    assert.deepEqual(BenchmarkClaimReferences.read(api, "dto-types"), [
      "markdown",
      "prisma",
    ]);
    assert.deepEqual(BenchmarkClaimReferences.read(api, "dto-properties"), [
      "prisma",
    ]);
    assert.deepEqual(BenchmarkClaimReferences.read(backend, "schema-models"), [
      "markdown",
    ]);
    assert.deepEqual(BenchmarkClaimReferences.read(backend, "api-operations"), [
      "markdown",
      "prisma",
    ]);
    assert.deepEqual(BenchmarkClaimReferences.read(backend, "backend-tests"), [
      "markdown",
      "typescript",
    ]);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}
