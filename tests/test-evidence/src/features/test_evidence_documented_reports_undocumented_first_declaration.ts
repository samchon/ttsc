import {
  type ITtscEvidenceProject,
  assertFailure,
  assertIncludes,
  createProject,
  runCheck,
} from "../internal/index";

/**
 * Verifies the packaged rule fails a build when only a later half of a merged
 * identity carries a block.
 *
 * This is the case that pins "the first declaration that can host a citation is
 * the basis" rather than "a block anywhere will do", and it is the firing twin
 * of the accepting fixture — without it, a rule that had stopped reading
 * placement entirely would look identical. Each fixture puts its block on a
 * later half of the merge, and every one of them is reported, because the
 * declaration written first is the identity's basis whichever kind it is.
 *
 * 1. Document the later half of an interface merge and of a class merge, and the
 *    default export rather than its const.
 * 2. Enable `evidence/documented` with the default selection.
 * 3. Assert a non-zero exit naming each identity.
 */
export const test_evidence_documented_reports_undocumented_first_declaration =
  (): void => {
    const project: ITtscEvidenceProject = createProject({
      name: "documented-first",
      include: ["src"],
      lintConfig: [
        'import { evidence } from "@ttsc/evidence";',
        "",
        "export default {",
        '  plugins: { "evidence": evidence },',
        "  rules: {",
        '    "evidence/documented": "error",',
        "  },",
        "};",
        "",
      ].join("\n"),
      files: {
        "src/ISale.ts": [
          "export interface ISale {",
          "  /** Identifier of the sale. */",
          "  id: string;",
          "}",
          "/** A sale offered to a customer. */",
          "export namespace ISale {",
          "  /** Creation input. */",
          "  export interface ICreate {",
          "    /** Identifier of the sale. */",
          "    id: string;",
          "  }",
          "}",
          "",
        ].join("\n"),
        "src/Something.ts": [
          "export class Something {}",
          "/** The exported service. */",
          "export namespace Something {",
          "  /** Current version. */",
          '  export const version = "1";',
          "}",
          "",
        ].join("\n"),
        "src/evidence.ts": [
          'export const evidence = { name: "evidence" };',
          "/** The exported plugin descriptor. */",
          "export default evidence;",
          "",
        ].join("\n"),
      },
    });
    try {
      const result = runCheck(project.directory);
      assertFailure(
        result,
        "A block on a later half must not satisfy the first declaration.",
      );
      assertIncludes(
        result,
        "Missing JSDoc on exported type 'ISale'",
        "The interface comes first, so it is the identity's basis.",
      );
      assertIncludes(
        result,
        "Missing JSDoc on exported type 'Something'",
        "A class founds the identity it merges with, so a block on the namespace half does not document it.",
      );
      assertIncludes(
        result,
        "Missing JSDoc on exported property 'evidence'",
        "A const founds the identity its default export re-exposes.",
      );
    } finally {
      project.cleanup();
    }
  };
