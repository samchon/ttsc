import {
  type ITtscEvidenceProject,
  assertExcludes,
  assertStatus,
  createProject,
  runCheck,
} from "../internal/index";

/**
 * Verifies the packaged rule accepts a merged identity documented at its first
 * declaration.
 *
 * This is the idiom a consumer meets first, and the one `evidence/singular`
 * blesses by name. Each fixture reaches its first declaration through a
 * different route — an interface founding a type family, a class founding a
 * merged class identity, an overload run, a variable statement behind a default
 * export — and two of them document every half, since nothing beyond the first
 * is asked for or objected to. Driving that through the real binary is what
 * proves the agreement between the two rules survives packaging.
 *
 * 1. Declare an interface, a class, an overload set, and a default export, each
 *    documented on its first declaration and some on every half.
 * 2. Enable `evidence/documented` with the default selection.
 * 3. Assert a clean exit.
 */
export const test_evidence_documented_accepts_merged_identities = (): void => {
  const project: ITtscEvidenceProject = createProject({
    name: "documented-merged",
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
        "/** A sale offered to a customer. */",
        "export interface ISale {",
        "  /** Identifier of the sale. */",
        "  id: string;",
        "}",
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
        "/** The exported service. */",
        "export class Something {}",
        "export namespace Something {",
        "  /** Current version. */",
        '  export const version = "1";',
        "}",
        "",
      ].join("\n"),
      "src/format.ts": [
        "/** Renders a string for display. */",
        "export function format(value: string): string;",
        "/** Renders a number for display. */",
        "export function format(value: number): string;",
        "/** Renders either for display. */",
        "export function format(value: string | number): string {",
        "  return String(value);",
        "}",
        "",
      ].join("\n"),
      "src/evidence.ts": [
        "/** The exported descriptor. */",
        'export const evidence = { name: "evidence" };',
        "/** The default export of this module. */",
        "export default evidence;",
        "",
      ].join("\n"),
    },
  });
  try {
    const result = runCheck(project.directory);
    assertStatus(
      result,
      0,
      "A block on an identity's first declaration must document the whole merge, matching evidence/singular.",
    );
    assertExcludes(
      result,
      "evidence/documented",
      "An identity documented at its first declaration must produce no finding.",
    );
  } finally {
    project.cleanup();
  }
};
