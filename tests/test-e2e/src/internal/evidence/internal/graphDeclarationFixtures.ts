import { FixtureFiles } from "../../FixtureFiles";
/**
 * Original declaration inputs and isolated active-population controls.
 *
 * @evidence contracts/common.md#principled-implementation Original authored sources, imports, typed configs and literal finding expectations are maintained inputs; only five explicit uncited controls extend those populations to prove activation.
 * @evidence contracts/common.md#clear-and-simple-design Each record couples declaration bytes, graph settings and its independent diagnostic expectations to the canonical consumer entry.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The table supplies no compiler result or producer proof. Actual CLI output supplies every observation, and the merged/barrel cases retain their original distinct negative findings without extra controls.
 * @evidence contracts/common.md#meaningful-documentation Individual case notes identify source shapes, asserted findings, actual execution ownership and the type-only namespace coverage retained here.
 */
export const graphDeclarationFixtures = [
  {
    /**
     * Verifies materializes all callable forms.
     *
     * The accessor fixture separately rejects accessor fields as function obligations.
     *
     * 1. Eleven declared, arrow, expression, instance/static method, function-field and namespace callables are cited by IClaim.
     * 2. Run the canonical consumer CLI with this isolated source population.
     * 3. Original sources have no source-anchored findings; only the appended boundaryCallableUncited finding appears exactly once in this population.
     *
     * Behavioral verification (contracts/testing.md#behavioral-verification): Eleven declared, arrow, expression, instance/static method, function-field and namespace callables are cited by IClaim. Original sources have no source-anchored findings; only the appended boundaryCallableUncited finding appears exactly once in this population.
     * Independent expectations (contracts/testing.md#independent-expectations): Authored export/citation identities and the literal control or expectedIncludes/expectedExcludes values below prescribe the result; no compiler observation computes the expected names.
     * Distinguishing cases (contracts/testing.md#distinguishing-cases): The accessor fixture separately rejects accessor fields as function obligations.
     * Execution ownership (contracts/testing.md#execution-ownership): test_evidence_file_rules_share_one_consumer_check materializes and asserts this dynamic E2E scene in its actual CLI baseline; this table item has no independent test selector.
     * Necessary boundary (contracts/e2e.md#necessary-boundary): Actual compiler source/declaration identity, imported namespace or export-space resolution and native graph options must connect to source-anchored diagnostics, beyond direct semantic calls.
     * Shared execution (contracts/e2e.md#shared-execution): Seven declaration scenes and eleven file-rule cases share the same consumer, authored contributor producer and single initial CLI check; this item adds no installation, native link or host.
     * State isolation and reuse validity (contracts/e2e.md#state-isolation-and-reuse-validity): Its disjoint src/graph_materializes_all_callable_forms root and prefixed TypeScript references preserve the original population. All source/config bytes are materialized before checking; the outer owner collects failures, joins its sidecar and removes the fixture.
     * Preserved coverage (contracts/e2e.md#preserved-coverage): Every original source/import/config and the specified silence or literal findings remain asserted by the canonical entry. The complementary portable owner is tests/test-evidence/go/semantic_graph_materializes_all_callable_forms_test.go; it does not replace this actual compiler/config connection.
     */
    "name": "materializes_all_callable_forms",
    "files": FixtureFiles.read("evidence/graphDeclarationFixtures/inputs-1"),
    "options": {
      "claims": [
        {
          "type": "typescript",
          "files": [
            "src/claim.ts"
          ],
          "symbol": "type",
          "reference": {
            "type": "typescript",
            "files": [
              "src/contracts.ts"
            ],
            "symbol": "function"
          }
        }
      ]
    },
    "typingConfig": "import type { ITtscLintConfig } from \"@ttsc/lint\";\nimport { evidence } from \"@ttsc/evidence\";\n\nexport default {\n  plugins: { \"evidence\": evidence },\n  rules: {\n    \"evidence/graph\": [\"error\", {\n      claims: [{\n        type: \"typescript\",\n        files: [\"src/claim.ts\"],\n        symbol: \"type\",\n        reference: {\n          type: \"typescript\",\n          files: [\"src/contracts.ts\"],\n          symbol: \"function\",\n        },\n      }],\n    }],\n  },\n} satisfies ITtscLintConfig;\n",
    "control": {
      "file": "src/contracts.ts",
      "source": "\nexport function boundaryCallableUncited(): void {}\n",
      "finding": "Missing acknowledgement for 'boundaryCallableUncited'"
    }
  },
  {
    /**
     * Verifies materializes destructured exports.
     *
     * The private hidden binding is not exported; actual compiler destructuring/export identities must remain distinct.
     *
     * 1. Shorthand, renamed, nested, object-rest, array/rest and export-list bindings are cited and imported by use.ts.
     * 2. Run the canonical consumer CLI with this isolated source population.
     * 3. Original sources remain clean and only boundaryDestructuredUncited appears exactly once.
     *
     * Behavioral verification (contracts/testing.md#behavioral-verification): Shorthand, renamed, nested, object-rest, array/rest and export-list bindings are cited and imported by use.ts. Original sources remain clean and only boundaryDestructuredUncited appears exactly once.
     * Independent expectations (contracts/testing.md#independent-expectations): Authored export/citation identities and the literal control or expectedIncludes/expectedExcludes values below prescribe the result; no compiler observation computes the expected names.
     * Distinguishing cases (contracts/testing.md#distinguishing-cases): The private hidden binding is not exported; actual compiler destructuring/export identities must remain distinct.
     * Execution ownership (contracts/testing.md#execution-ownership): test_evidence_file_rules_share_one_consumer_check materializes and asserts this dynamic E2E scene in its actual CLI baseline; this table item has no independent test selector.
     * Necessary boundary (contracts/e2e.md#necessary-boundary): Actual compiler source/declaration identity, imported namespace or export-space resolution and native graph options must connect to source-anchored diagnostics, beyond direct semantic calls.
     * Shared execution (contracts/e2e.md#shared-execution): Seven declaration scenes and eleven file-rule cases share the same consumer, authored contributor producer and single initial CLI check; this item adds no installation, native link or host.
     * State isolation and reuse validity (contracts/e2e.md#state-isolation-and-reuse-validity): Its disjoint src/graph_materializes_destructured_exports root and prefixed TypeScript references preserve the original population. All source/config bytes are materialized before checking; the outer owner collects failures, joins its sidecar and removes the fixture.
     * Preserved coverage (contracts/e2e.md#preserved-coverage): Every original source/import/config and the specified silence or literal findings remain asserted by the canonical entry. The complementary portable owner is tests/test-evidence/go/semantic_graph_materializes_destructured_exports_test.go; it does not replace this actual compiler/config connection.
     */
    "name": "materializes_destructured_exports",
    "files": FixtureFiles.read("evidence/graphDeclarationFixtures/inputs-2"),
    "options": {
      "claims": [
        {
          "type": "typescript",
          "files": [
            "src/claim.ts"
          ],
          "symbol": "type",
          "reference": {
            "type": "typescript",
            "files": [
              "src/contracts.ts"
            ],
            "symbol": "property"
          }
        }
      ]
    },
    "typingConfig": "import evidence from \"@ttsc/evidence\";\n\nexport default {\n  plugins: { \"evidence\": evidence },\n  rules: {\n    \"evidence/graph\": [\"error\", {\n      claims: [{\n        type: \"typescript\",\n        files: [\"src/claim.ts\"],\n        symbol: \"type\",\n        reference: {\n          type: \"typescript\",\n          files: [\"src/contracts.ts\"],\n          symbol: \"property\",\n        },\n      }],\n    }],\n  },\n};\n",
    "control": {
      "file": "src/contracts.ts",
      "source": "\nexport const boundaryDestructuredUncited = 0;\n",
      "finding": "Missing acknowledgement for 'boundaryDestructuredUncited'"
    }
  },
  {
    /**
     * Verifies materializes ambient namespace members.
     *
     * The type-only namespace fixture has a different compiler export-space boundary.
     *
     * 1. A .d.ts Ambient namespace exposes Input, run, state and Nested.work, imported by real consuming source and covered by the ancestor citation.
     * 2. Run the canonical consumer CLI with this isolated source population.
     * 3. Original declaration/consumer sources remain clean and only BoundaryAmbientUncited appears exactly once.
     *
     * Behavioral verification (contracts/testing.md#behavioral-verification): A .d.ts Ambient namespace exposes Input, run, state and Nested.work, imported by real consuming source and covered by the ancestor citation. Original declaration/consumer sources remain clean and only BoundaryAmbientUncited appears exactly once.
     * Independent expectations (contracts/testing.md#independent-expectations): Authored export/citation identities and the literal control or expectedIncludes/expectedExcludes values below prescribe the result; no compiler observation computes the expected names.
     * Distinguishing cases (contracts/testing.md#distinguishing-cases): The type-only namespace fixture has a different compiler export-space boundary.
     * Execution ownership (contracts/testing.md#execution-ownership): test_evidence_file_rules_share_one_consumer_check materializes and asserts this dynamic E2E scene in its actual CLI baseline; this table item has no independent test selector.
     * Necessary boundary (contracts/e2e.md#necessary-boundary): Actual compiler source/declaration identity, imported namespace or export-space resolution and native graph options must connect to source-anchored diagnostics, beyond direct semantic calls.
     * Shared execution (contracts/e2e.md#shared-execution): Seven declaration scenes and eleven file-rule cases share the same consumer, authored contributor producer and single initial CLI check; this item adds no installation, native link or host.
     * State isolation and reuse validity (contracts/e2e.md#state-isolation-and-reuse-validity): Its disjoint src/graph_materializes_ambient_namespace_members root and prefixed TypeScript references preserve the original population. All source/config bytes are materialized before checking; the outer owner collects failures, joins its sidecar and removes the fixture.
     * Preserved coverage (contracts/e2e.md#preserved-coverage): Every original source/import/config and the specified silence or literal findings remain asserted by the canonical entry. The complementary portable owner is tests/test-evidence/go/semantic_graph_materializes_ambient_namespace_members_test.go; it does not replace this actual compiler/config connection.
     */
    "name": "materializes_ambient_namespace_members",
    "files": FixtureFiles.read("evidence/graphDeclarationFixtures/inputs-3"),
    "options": {
      "claims": [
        {
          "type": "typescript",
          "files": [
            "src/claim.ts"
          ],
          "symbol": "type",
          "reference": {
            "type": "typescript",
            "files": [
              "src/contracts.d.ts"
            ],
            "symbol": [
              "type",
              "function",
              "property"
            ]
          }
        }
      ]
    },
    "typingConfig": "import evidence from \"@ttsc/evidence\";\n\nexport default {\n  plugins: { \"evidence\": evidence },\n  rules: {\n    \"evidence/graph\": [\"error\", {\n      claims: [{\n        type: \"typescript\",\n        files: [\"src/claim.ts\"],\n        symbol: \"type\",\n        reference: {\n          type: \"typescript\",\n          files: [\"src/contracts.d.ts\"],\n          symbol: [\"type\", \"function\", \"property\"],\n        },\n      }],\n    }],\n  },\n};\n",
    "control": {
      "file": "src/contracts.d.ts",
      "source": "\nexport interface BoundaryAmbientUncited {}\n",
      "finding": "Missing acknowledgement for 'BoundaryAmbientUncited'"
    }
  },
  {
    /**
     * Verifies excludes auto accessors.
     *
     * An ordinary function field is selected while an accessor with a callable initializer is not.
     *
     * 1. Service has cited callable handler/factory fields beside uncited accessor callback/provider declarations.
     * 2. Run the canonical consumer CLI with this isolated source population.
     * 3. Original sources remain clean and only boundaryAccessorUncited appears exactly once.
     *
     * Behavioral verification (contracts/testing.md#behavioral-verification): Service has cited callable handler/factory fields beside uncited accessor callback/provider declarations. Original sources remain clean and only boundaryAccessorUncited appears exactly once.
     * Independent expectations (contracts/testing.md#independent-expectations): Authored export/citation identities and the literal control or expectedIncludes/expectedExcludes values below prescribe the result; no compiler observation computes the expected names.
     * Distinguishing cases (contracts/testing.md#distinguishing-cases): An ordinary function field is selected while an accessor with a callable initializer is not.
     * Execution ownership (contracts/testing.md#execution-ownership): test_evidence_file_rules_share_one_consumer_check materializes and asserts this dynamic E2E scene in its actual CLI baseline; this table item has no independent test selector.
     * Necessary boundary (contracts/e2e.md#necessary-boundary): Actual compiler source/declaration identity, imported namespace or export-space resolution and native graph options must connect to source-anchored diagnostics, beyond direct semantic calls.
     * Shared execution (contracts/e2e.md#shared-execution): Seven declaration scenes and eleven file-rule cases share the same consumer, authored contributor producer and single initial CLI check; this item adds no installation, native link or host.
     * State isolation and reuse validity (contracts/e2e.md#state-isolation-and-reuse-validity): Its disjoint src/graph_excludes_auto_accessors root and prefixed TypeScript references preserve the original population. All source/config bytes are materialized before checking; the outer owner collects failures, joins its sidecar and removes the fixture.
     * Preserved coverage (contracts/e2e.md#preserved-coverage): Every original source/import/config and the specified silence or literal findings remain asserted by the canonical entry. The complementary portable owner is tests/test-evidence/go/semantic_graph_excludes_auto_accessors_test.go; it does not replace this actual compiler/config connection.
     */
    "name": "excludes_auto_accessors",
    "files": FixtureFiles.read("evidence/graphDeclarationFixtures/inputs-4"),
    "options": {
      "claims": [
        {
          "type": "typescript",
          "files": [
            "src/claim.ts"
          ],
          "symbol": "type",
          "reference": {
            "type": "typescript",
            "files": [
              "src/contracts.ts"
            ],
            "symbol": "function"
          }
        }
      ]
    },
    "typingConfig": "import evidence from \"@ttsc/evidence\";\n\nexport default {\n  plugins: { \"evidence\": evidence },\n  rules: {\n    \"evidence/graph\": [\"error\", {\n      claims: [{\n        type: \"typescript\",\n        files: [\"src/claim.ts\"],\n        symbol: \"type\",\n        reference: {\n          type: \"typescript\",\n          files: [\"src/contracts.ts\"],\n          symbol: \"function\",\n        },\n      }],\n    }],\n  },\n};\n",
    "control": {
      "file": "src/contracts.ts",
      "source": "\nexport function boundaryAccessorUncited(): void {}\n",
      "finding": "Missing acknowledgement for 'boundaryAccessorUncited'"
    }
  },
  {
    /**
     * Verifies materializes type only namespace aliases.
     *
     * The imported type namespace remains resolvable and its uncited namespace control stays active.
     *
     * 1. Local exports interface, type, function and value members but is exported/imported through type-only Public; IClaim cites its ancestor.
     * 2. Run the canonical consumer CLI with this isolated source population.
     * 3. Original sources remain clean, Unresolved evidence target is absent and only BoundaryNamespaceUncited appears exactly once.
     *
     * Behavioral verification (contracts/testing.md#behavioral-verification): Local exports interface, type, function and value members but is exported/imported through type-only Public; IClaim cites its ancestor. Original sources remain clean, Unresolved evidence target is absent and only BoundaryNamespaceUncited appears exactly once.
     * Independent expectations (contracts/testing.md#independent-expectations): Authored export/citation identities and the literal control or expectedIncludes/expectedExcludes values below prescribe the result; no compiler observation computes the expected names.
     * Distinguishing cases (contracts/testing.md#distinguishing-cases): Namespace resolution and one uncited namespace control are asserted. The ancestor citation covers its descendants, so this case does not independently exclude accidentally populated value-space members; the neighboring type-only barrel case owns its explicit value-member absence assertion.
     * Execution ownership (contracts/testing.md#execution-ownership): test_evidence_file_rules_share_one_consumer_check materializes and asserts this dynamic E2E scene in its actual CLI baseline; this table item has no independent test selector.
     * Necessary boundary (contracts/e2e.md#necessary-boundary): Actual compiler source/declaration identity, imported namespace or export-space resolution and native graph options must connect to source-anchored diagnostics, beyond direct semantic calls.
     * Shared execution (contracts/e2e.md#shared-execution): Seven declaration scenes and eleven file-rule cases share the same consumer, authored contributor producer and single initial CLI check; this item adds no installation, native link or host.
     * State isolation and reuse validity (contracts/e2e.md#state-isolation-and-reuse-validity): Its disjoint src/graph_materializes_type_only_namespace_aliases root and prefixed TypeScript references preserve the original population. All source/config bytes are materialized before checking; the outer owner collects failures, joins its sidecar and removes the fixture.
     * Preserved coverage (contracts/e2e.md#preserved-coverage): Every original source/import/config and the specified silence or literal findings remain asserted by the canonical entry. No verified portable counterpart replaces this type-only namespace boundary.
     */
    "name": "materializes_type_only_namespace_aliases",
    "files": FixtureFiles.read("evidence/graphDeclarationFixtures/inputs-5"),
    "options": {
      "claims": [
        {
          "type": "typescript",
          "files": [
            "src/claim.ts"
          ],
          "symbol": "type",
          "reference": {
            "type": "typescript",
            "files": [
              "src/contracts.ts"
            ],
            "symbol": [
              "type",
              "property"
            ]
          }
        }
      ]
    },
    "typingConfig": "import evidence from \"@ttsc/evidence\";\n\nexport default {\n  plugins: { \"evidence\": evidence },\n  rules: {\n    \"evidence/graph\": [\"error\", {\n      claims: [{\n        type: \"typescript\",\n        files: [\"src/claim.ts\"],\n        symbol: \"type\",\n        reference: {\n          type: \"typescript\",\n          files: [\"src/contracts.ts\"],\n          symbol: [\"type\", \"property\"],\n        },\n      }],\n    }],\n  },\n};\n",
    "control": {
      "file": "src/contracts.ts",
      "source": "\nexport interface BoundaryNamespaceUncited {}\n",
      "finding": "Missing acknowledgement for 'BoundaryNamespaceUncited'"
    },
    "expectedIncludes": [],
    "expectedExcludes": [
      "Unresolved evidence target"
    ]
  },
  {
    /**
     * Verifies resolves merged identity from first declaration.
     *
     * Declaration identity and later citation coverage are independently checked; this case has no added uncited control.
     *
     * 1. An undocumented first ISale interface merges with a later namespace that cites Sale Price.
     * 2. Run the canonical consumer CLI with this isolated source population.
     * 3. Original sources remain clean; the literal ISale missing finding retains its first declaration at src/ISale.ts:1, and Sale Price is absent.
     *
     * Behavioral verification (contracts/testing.md#behavioral-verification): An undocumented first ISale interface merges with a later namespace that cites Sale Price. Original sources remain clean; the literal ISale missing finding retains its first declaration at src/ISale.ts:1, and Sale Price is absent.
     * Independent expectations (contracts/testing.md#independent-expectations): Authored export/citation identities and the literal control or expectedIncludes/expectedExcludes values below prescribe the result; no compiler observation computes the expected names.
     * Distinguishing cases (contracts/testing.md#distinguishing-cases): Declaration identity and later citation coverage are independently checked; this case has no added uncited control.
     * Execution ownership (contracts/testing.md#execution-ownership): test_evidence_file_rules_share_one_consumer_check materializes and asserts this dynamic E2E scene in its actual CLI baseline; this table item has no independent test selector.
     * Necessary boundary (contracts/e2e.md#necessary-boundary): Actual compiler source/declaration identity, imported namespace or export-space resolution and native graph options must connect to source-anchored diagnostics, beyond direct semantic calls.
     * Shared execution (contracts/e2e.md#shared-execution): Seven declaration scenes and eleven file-rule cases share the same consumer, authored contributor producer and single initial CLI check; this item adds no installation, native link or host.
     * State isolation and reuse validity (contracts/e2e.md#state-isolation-and-reuse-validity): Its disjoint src/graph_resolves_merged_identity_from_first_declaration root and prefixed TypeScript references preserve the original population. All source/config bytes are materialized before checking; the outer owner collects failures, joins its sidecar and removes the fixture.
     * Preserved coverage (contracts/e2e.md#preserved-coverage): Every original source/import/config and the specified silence or literal findings remain asserted by the canonical entry. The complementary portable owner is tests/test-evidence/go/semantic_graph_resolves_merged_identity_from_first_declaration_test.go; it does not replace this actual compiler/config connection.
     */
    "name": "resolves_merged_identity_from_first_declaration",
    "files": FixtureFiles.read("evidence/graphDeclarationFixtures/inputs-6"),
    "options": {
      "claims": [
        {
          "type": "typescript",
          "files": [
            "src/ledger.ts"
          ],
          "symbol": "type",
          "reference": {
            "type": "typescript",
            "files": [
              "src/ISale.ts"
            ],
            "symbol": "type"
          }
        },
        {
          "type": "typescript",
          "files": [
            "src/**"
          ],
          "symbol": "type",
          "reference": {
            "type": "markdown",
            "files": [
              "docs/spec.md"
            ],
            "symbol": "h2"
          }
        }
      ]
    },
    "typingConfig": "import { evidence } from \"@ttsc/evidence\";\n\nexport default {\n  plugins: { \"evidence\": evidence },\n  rules: {\n    \"evidence/graph\": [\"error\", {\n      claims: [{\n        type: \"typescript\",\n        files: [\"src/ledger.ts\"],\n        symbol: \"type\",\n        reference: {\n          type: \"typescript\",\n          files: [\"src/ISale.ts\"],\n          symbol: \"type\",\n        },\n      }, {\n        type: \"typescript\",\n        files: [\"src/**\"],\n        symbol: \"type\",\n        reference: {\n          type: \"markdown\",\n          files: [\"docs/spec.md\"],\n          symbol: \"h2\",\n        },\n      }],\n    }],\n  },\n};\n",
    "control": null,
    "expectedIncludes": [
      "Missing acknowledgement for 'ISale' (TypeScript type 'ISale' at src/ISale.ts:1)"
    ],
    "expectedExcludes": [
      "docs/spec.md#sale-price"
    ]
  },
  {
    /**
     * Verifies withholds value space from a type only barrel.
     *
     * Plain interface shape survives a type-only export while class instance value-space members do not; no artificial control is added.
     *
     * 1. The barrel reexports Sale class and IPlain interface through export type while an empty ledger exposes obligations.
     * 2. Run the canonical consumer CLI with this isolated source population.
     * 3. Original sources remain clean; IPlain.rate is missing and Sale.prototype.price is absent.
     *
     * Behavioral verification (contracts/testing.md#behavioral-verification): The barrel reexports Sale class and IPlain interface through export type while an empty ledger exposes obligations. Original sources remain clean; IPlain.rate is missing and Sale.prototype.price is absent.
     * Independent expectations (contracts/testing.md#independent-expectations): Authored export/citation identities and the literal control or expectedIncludes/expectedExcludes values below prescribe the result; no compiler observation computes the expected names.
     * Distinguishing cases (contracts/testing.md#distinguishing-cases): Plain interface shape survives a type-only export while class instance value-space members do not; no artificial control is added.
     * Execution ownership (contracts/testing.md#execution-ownership): test_evidence_file_rules_share_one_consumer_check materializes and asserts this dynamic E2E scene in its actual CLI baseline; this table item has no independent test selector.
     * Necessary boundary (contracts/e2e.md#necessary-boundary): Actual compiler source/declaration identity, imported namespace or export-space resolution and native graph options must connect to source-anchored diagnostics, beyond direct semantic calls.
     * Shared execution (contracts/e2e.md#shared-execution): Seven declaration scenes and eleven file-rule cases share the same consumer, authored contributor producer and single initial CLI check; this item adds no installation, native link or host.
     * State isolation and reuse validity (contracts/e2e.md#state-isolation-and-reuse-validity): Its disjoint src/graph_withholds_value_space_from_a_type_only_barrel root and prefixed TypeScript references preserve the original population. All source/config bytes are materialized before checking; the outer owner collects failures, joins its sidecar and removes the fixture.
     * Preserved coverage (contracts/e2e.md#preserved-coverage): Every original source/import/config and the specified silence or literal findings remain asserted by the canonical entry. The complementary portable owner is tests/test-evidence/go/semantic_graph_withholds_value_space_from_a_type_only_barrel_test.go; it does not replace this actual compiler/config connection.
     */
    "name": "withholds_value_space_from_a_type_only_barrel",
    "files": FixtureFiles.read("evidence/graphDeclarationFixtures/inputs-7"),
    "options": {
      "claims": [
        {
          "type": "typescript",
          "files": [
            "src/ledger.ts"
          ],
          "symbol": "type",
          "reference": {
            "type": "typescript",
            "files": [
              "src/index.ts"
            ],
            "symbol": [
              "type",
              "function",
              "property"
            ]
          }
        }
      ]
    },
    "typingConfig": "import evidence from \"@ttsc/evidence\";\n\nexport default {\n  plugins: { \"evidence\": evidence },\n  rules: {\n    \"evidence/graph\": [\"error\", {\n      claims: [{\n        type: \"typescript\",\n        files: [\"src/ledger.ts\"],\n        symbol: \"type\",\n        reference: {\n          type: \"typescript\",\n          files: [\"src/index.ts\"],\n          symbol: [\"type\", \"function\", \"property\"],\n        },\n      }],\n    }],\n  },\n};\n",
    "control": null,
    "expectedIncludes": [
      "Missing acknowledgement for 'IPlain.rate'"
    ],
    "expectedExcludes": [
      "Sale.prototype.price"
    ]
  }
];
