import {
  type ITtscEvidenceProject,
  assertExcludes,
  assertFailure,
  assertIncludes,
  createProject,
  runCheck,
} from "../internal/index";

/**
 * Verifies a barrel's type-only re-export withholds value-space from the
 * packaged rule.
 *
 * The mark used to stop at the module boundary, so `export type { Sale } from`
 * published every class member the declaring file held while the same intent
 * written locally withheld them. Driving it through the real binary is what
 * proves the traversal answers the same way once the rule is packaged, where
 * the Go suite only proves the collector.
 *
 * A clean exit would not distinguish a withheld population from a reference
 * that reached nothing: both are silent. The barrel therefore also re-exports
 * an interface no class merges with, whose members are type-space and must
 * survive, and the case demands the build fail naming exactly that interface's
 * member with no class member among the names.
 *
 * 1. Declare a class with a member and an interface with a member.
 * 2. Re-export both from a barrel with `export type { … } from`.
 * 3. Assert the build fails naming the interface member alone.
 */
export const test_evidence_graph_withholds_value_space_from_a_type_only_barrel =
  (): void => {
    const project: ITtscEvidenceProject = createProject({
      name: "type-only-barrel",
      lintConfig: [
        'import evidence from "@ttsc/evidence";',
        "",
        "export default {",
        '  plugins: { "evidence": evidence },',
        "  rules: {",
        '    "evidence/graph": ["error", {',
        "      claims: [{",
        '        type: "typescript",',
        '        files: ["src/ledger.ts"],',
        '        symbol: "type",',
        "        reference: {",
        '          type: "typescript",',
        '          files: ["src/index.ts"],',
        '          symbol: ["type", "function", "property"],',
        "        },",
        "      }],",
        "    }],",
        "  },",
        "};",
        "",
      ].join("\n"),
      files: {
        "src/sale.ts": [
          "/** A sale offered to a customer. */",
          "export class Sale {",
          "  /** The amount the customer pays. */",
          "  public readonly price: number = 0;",
          "}",
          "",
          "/** A plain contract no class merges with. */",
          "export interface IPlain {",
          "  /** The rate this contract fixes. */",
          "  rate: number;",
          "}",
          "",
        ].join("\n"),
        "src/index.ts": [
          'export type { Sale, IPlain } from "./sale.js";',
          "",
        ].join("\n"),
        "src/ledger.ts": [
          "/** This claim cites nothing, so the population reports itself. */",
          "export interface ILedger {}",
          "",
        ].join("\n"),
      },
    });
    try {
      const result = runCheck(project.directory);
      assertFailure(
        result,
        "The surviving type-space units must keep the build red, which is what proves the reference reached the barrel at all.",
      );
      assertIncludes(
        result,
        "Missing acknowledgement for 'IPlain.rate'",
        "A member of an interface no class merges with is type-space and survives a type-only edge.",
      );
      assertExcludes(
        result,
        "Sale.prototype.price",
        "A class member is reached through the class value, which a type-only export does not carry.",
      );
    } finally {
      project.cleanup();
    }
  };
