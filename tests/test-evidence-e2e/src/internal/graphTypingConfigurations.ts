/** Original graph consumer configurations, checked together without loading them. */
export const graphTypingConfigurations = [
  {
    "name": "test_evidence_graph_accepts_exclusions_anywhere_without_carriers",
    "source": "import type { ITtscLintConfig } from \"@ttsc/lint\";\nimport { evidence, type ITtscEvidenceGraphConfig } from \"@ttsc/evidence\";\n\nconst graph: ITtscEvidenceGraphConfig = {\n  claims: [\n    {\n      name: \"operations\",\n      type: \"typescript\",\n      files: [\"src/**/*.ts\"],\n      symbol: \"function\",\n      reference: {\n        type: \"markdown\",\n        files: [\"docs/spec.md\"],\n        symbol: \"h2\",\n      },\n    },\n  ],\n};\n\nexport default {\n  plugins: { evidence },\n  rules: { \"evidence/graph\": [\"error\", graph] },\n} satisfies ITtscLintConfig;\n"
  },
  {
    "name": "test_evidence_graph_cites_a_constructor_parameter_property",
    "source": "import evidence from \"@ttsc/evidence\";\n\nexport default {\n  plugins: { \"evidence\": evidence },\n  rules: {\n    \"evidence/graph\": [\"error\", {\n      claims: [{\n        type: \"typescript\",\n        files: [\"src/Sale.ts\"],\n        symbol: \"property\",\n        reference: {\n          type: \"markdown\",\n          files: [\"docs/fields.md\"],\n          symbol: \"h2\",\n        },\n      }],\n    }],\n  },\n};\n"
  },
  {
    "name": "test_evidence_graph_cites_an_interface_callable",
    "source": "import evidence from \"@ttsc/evidence\";\n\nexport default {\n  plugins: { \"evidence\": evidence },\n  rules: {\n    \"evidence/graph\": [\"error\", {\n      claims: [{\n        type: \"typescript\",\n        files: [\"src/ISale.ts\"],\n        symbol: \"function\",\n        reference: {\n          type: \"markdown\",\n          files: [\"docs/behaviour.md\"],\n          symbol: \"h2\",\n        },\n      }],\n    }],\n  },\n};\n"
  },
  {
    "name": "test_evidence_graph_confines_exclusions_to_declared_carriers",
    "source": "import type { ITtscLintConfig } from \"@ttsc/lint\";\nimport { evidence, type ITtscEvidenceGraphConfig } from \"@ttsc/evidence\";\n\nconst graph: ITtscEvidenceGraphConfig = {\n  claims: [\n    {\n      name: \"operations\",\n      type: \"typescript\",\n      files: [\"src/**/*.ts\"],\n      symbol: \"function\",\n      evidenceExcludeCarriers: [\"src/LEDGER.ts\"],\n      reference: {\n        type: \"markdown\",\n        files: [\"docs/spec.md\"],\n        symbol: \"h2\",\n      },\n    },\n  ],\n};\n\nexport default {\n  plugins: { evidence },\n  rules: { \"evidence/graph\": [\"error\", graph] },\n} satisfies ITtscLintConfig;\n"
  },
  {
    "name": "test_evidence_graph_derives_no_host_finding_from_an_empty_population",
    "source": "import evidence from \"@ttsc/evidence\";\n\nexport default {\n  plugins: { \"evidence\": evidence },\n  rules: {\n    \"evidence/graph\": [\"error\", {\n      claims: [\n        {\n          type: \"typescript\",\n          files: [\"src/**/*.ts\"],\n          symbol: \"function\",\n          reference: {\n            type: \"markdown\",\n            files: [\"docs/**\"],\n            symbol: \"h2\",\n            singleEvidencePerSymbol: true,\n          },\n        },\n      ],\n    }],\n  },\n};\n"
  },
  {
    "name": "test_evidence_graph_ignores_an_empty_rooted_typescript_claim",
    "source": "import evidence from \"@ttsc/evidence\";\n\nexport default {\n  plugins: { \"evidence\": evidence },\n  rules: {\n    \"evidence/graph\": [\"error\", {\n      claims: [\n        {\n          type: \"typescript\",\n          root: \"../shared\",\n          files: [\"src/**/*.ts\"],\n          symbol: \"type\",\n          reference: { type: \"markdown\", files: [\"docs/**\"], symbol: \"h2\" },\n        },\n      ],\n    }],\n  },\n};\n"
  },
  {
    "name": "test_evidence_graph_keeps_claims_independent",
    "source": "import type { ITtscLintConfig } from \"@ttsc/lint\";\nimport { evidence } from \"@ttsc/evidence\";\n\nexport default {\n  plugins: { \"evidence\": evidence },\n  rules: {\n    \"evidence/graph\": [\"error\", {\n      claims: [\n        {\n          type: \"typescript\",\n          files: [\"src/team-a.ts\"],\n          symbol: \"function\",\n          reference: { type: \"markdown\", files: [\"docs/spec.md\"], symbol: \"h2\" },\n        },\n        {\n          type: \"typescript\",\n          files: [\"src/team-b.ts\"],\n          symbol: \"function\",\n          reference: { type: \"markdown\", files: [\"docs/spec.md\"], symbol: \"h2\" },\n        },\n      ],\n    }],\n  },\n} satisfies ITtscLintConfig;\n"
  },
  {
    "name": "test_evidence_graph_names_an_unresolvable_typescript_root",
    "source": "import evidence from \"@ttsc/evidence\";\n\nexport default {\n  plugins: { \"evidence\": evidence },\n  rules: {\n    \"evidence/graph\": [\"error\", {\n      claims: [\n        {\n          type: \"typescript\",\n          root: \"../absent\",\n          files: [\"src/**/*.ts\"],\n          symbol: \"type\",\n          reference: { type: \"markdown\", files: [\"docs/**\"], symbol: \"h2\" },\n        },\n      ],\n    }],\n  },\n};\n"
  },
  {
    "name": "test_evidence_graph_refuses_code_evidence_to_a_document",
    "source": "import type { ITtscLintConfig } from \"@ttsc/lint\";\nimport { evidence } from \"@ttsc/evidence\";\n\nexport default {\n  plugins: { \"evidence\": evidence },\n  rules: {\n    \"evidence/graph\": [\"error\", {\n      claims: [{\n        type: \"markdown\",\n        files: [\"docs/**/*.md\"],\n        symbol: \"file\",\n        reference: { type: \"typescript\", files: [\"src/**/*.ts\"] },\n      }],\n    }],\n  },\n} satisfies ITtscLintConfig;\n"
  },
  {
    "name": "test_evidence_graph_reports_an_exclusion_outside_its_carrier",
    "source": "import type { ITtscLintConfig } from \"@ttsc/lint\";\nimport { evidence, type ITtscEvidenceGraphConfig } from \"@ttsc/evidence\";\n\nconst graph: ITtscEvidenceGraphConfig = {\n  claims: [\n    {\n      name: \"operations\",\n      type: \"typescript\",\n      files: [\"src/**/*.ts\"],\n      symbol: \"function\",\n      evidenceExcludeCarriers: [\"src/LEDGER.ts\"],\n      reference: {\n        type: \"markdown\",\n        files: [\"docs/spec.md\"],\n        symbol: \"h2\",\n      },\n    },\n  ],\n};\n\nexport default {\n  plugins: { evidence },\n  rules: { \"evidence/graph\": [\"error\", graph] },\n} satisfies ITtscLintConfig;\n"
  },
  {
    "name": "test_evidence_graph_reports_an_uncited_class",
    "source": "import evidence from \"@ttsc/evidence\";\n\nexport default {\n  plugins: { \"evidence\": evidence },\n  rules: {\n    \"evidence/graph\": [\"error\", {\n      claims: [{\n        type: \"typescript\",\n        files: [\"src/Sale.ts\"],\n        symbol: \"type\",\n        reference: {\n          type: \"markdown\",\n          files: [\"docs/subject.md\"],\n          symbol: \"h2\",\n        },\n      }],\n    }],\n  },\n};\n"
  },
  {
    "name": "test_evidence_graph_reports_an_unreadable_population_root",
    "source": "import evidence from \"@ttsc/evidence\";\n\nexport default {\n  plugins: { \"evidence\": evidence },\n  rules: {\n    \"evidence/graph\": [\"error\", {\n      claims: [\n        {\n          type: \"typescript\",\n          files: [\"src/**/*.ts\"],\n          symbol: \"type\",\n          reference: {\n            type: \"markdown\",\n            root: \"../documents\",\n            files: [\"requirements/**\"],\n            symbol: \"h2\",\n          },\n        },\n      ],\n    }],\n  },\n};\n"
  },
  {
    "name": "test_evidence_graph_reports_an_unselected_exclusion_carrier",
    "source": "import type { ITtscLintConfig } from \"@ttsc/lint\";\nimport { evidence, type ITtscEvidenceGraphConfig } from \"@ttsc/evidence\";\n\nconst graph: ITtscEvidenceGraphConfig = {\n  claims: [\n    {\n      name: \"operations\",\n      type: \"typescript\",\n      files: [\"src/**/*.ts\"],\n      evidenceExcludeCarriers: [\"vendor/LEDGER.ts\"],\n      symbol: \"function\",\n      reference: {\n        type: \"markdown\",\n        files: [\"docs/spec.md\"],\n        symbol: \"h2\",\n      },\n    },\n  ],\n};\n\nexport default {\n  plugins: { evidence },\n  rules: { \"evidence/graph\": [\"error\", graph] },\n} satisfies ITtscLintConfig;\n"
  },
  {
    "name": "test_evidence_graph_reports_declaration_failures",
    "source": "import type { ITtscLintConfig } from \"@ttsc/lint\";\nimport { evidence } from \"@ttsc/evidence\";\n\nexport default {\n  plugins: { \"evidence\": evidence },\n  rules: {\n    \"evidence/graph\": [\"error\", {\n      claims: [{\n        type: \"typescript\",\n        files: [\"src/citations.ts\"],\n        symbol: \"function\",\n        reference: {\n          type: \"markdown\",\n          files: [\"docs/spec.md\"],\n          symbol: \"h2\",\n        },\n      }],\n    }],\n  },\n} satisfies ITtscLintConfig;\n"
  },
  {
    "name": "test_evidence_graph_reports_non_participating_exclusion",
    "source": "import { evidence } from \"@ttsc/evidence\";\n\nexport default {\n  plugins: { \"evidence\": evidence },\n  rules: {\n    \"evidence/graph\": [\"error\", { claims: [\n      {\n        name: \"first\",\n        type: \"typescript\",\n        files: [\"src/first.ts\"],\n        symbol: \"type\",\n        reference: { type: \"markdown\", files: [\"docs/first.md\"], symbol: \"h2\" },\n      },\n      {\n        name: \"second\",\n        type: \"typescript\",\n        files: [\"src/second.ts\"],\n        symbol: \"type\",\n        reference: { type: \"markdown\", files: [\"docs/second.md\"], symbol: \"h2\" },\n      },\n    ] }],\n  },\n};\n"
  }
];
