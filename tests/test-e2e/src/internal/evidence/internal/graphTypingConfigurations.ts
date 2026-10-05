/**
 * Original graph consumer configurations, checked together without loading
 * them.
 */
export const graphTypingConfigurations = [
  {
    name: "evidence graph accepts exclusions anywhere without carriers",
    source:
      'import type { ITtscLintConfig } from "@ttsc/lint";\nimport { evidence, type ITtscEvidenceGraphConfig } from "@ttsc/evidence";\n\nconst graph: ITtscEvidenceGraphConfig = {\n  claims: [\n    {\n      name: "operations",\n      type: "typescript",\n      files: ["src/**/*.ts"],\n      symbol: "function",\n      reference: {\n        type: "markdown",\n        files: ["docs/spec.md"],\n        symbol: "h2",\n      },\n    },\n  ],\n};\n\nexport default {\n  plugins: { evidence },\n  rules: { "evidence/graph": ["error", graph] },\n} satisfies ITtscLintConfig;\n',
  },
  {
    name: "evidence graph cites a constructor parameter property",
    source:
      'import evidence from "@ttsc/evidence";\n\nexport default {\n  plugins: { "evidence": evidence },\n  rules: {\n    "evidence/graph": ["error", {\n      claims: [{\n        type: "typescript",\n        files: ["src/Sale.ts"],\n        symbol: "property",\n        reference: {\n          type: "markdown",\n          files: ["docs/fields.md"],\n          symbol: "h2",\n        },\n      }],\n    }],\n  },\n};\n',
  },
  {
    name: "evidence graph cites an interface callable",
    source:
      'import evidence from "@ttsc/evidence";\n\nexport default {\n  plugins: { "evidence": evidence },\n  rules: {\n    "evidence/graph": ["error", {\n      claims: [{\n        type: "typescript",\n        files: ["src/ISale.ts"],\n        symbol: "function",\n        reference: {\n          type: "markdown",\n          files: ["docs/behaviour.md"],\n          symbol: "h2",\n        },\n      }],\n    }],\n  },\n};\n',
  },
  {
    name: "evidence graph confines exclusions to declared carriers",
    source:
      'import type { ITtscLintConfig } from "@ttsc/lint";\nimport { evidence, type ITtscEvidenceGraphConfig } from "@ttsc/evidence";\n\nconst graph: ITtscEvidenceGraphConfig = {\n  claims: [\n    {\n      name: "operations",\n      type: "typescript",\n      files: ["src/**/*.ts"],\n      symbol: "function",\n      evidenceExcludeCarriers: ["src/LEDGER.ts"],\n      reference: {\n        type: "markdown",\n        files: ["docs/spec.md"],\n        symbol: "h2",\n      },\n    },\n  ],\n};\n\nexport default {\n  plugins: { evidence },\n  rules: { "evidence/graph": ["error", graph] },\n} satisfies ITtscLintConfig;\n',
  },
  {
    name: "evidence graph derives no host finding from an empty population",
    source:
      'import evidence from "@ttsc/evidence";\n\nexport default {\n  plugins: { "evidence": evidence },\n  rules: {\n    "evidence/graph": ["error", {\n      claims: [\n        {\n          type: "typescript",\n          files: ["src/**/*.ts"],\n          symbol: "function",\n          reference: {\n            type: "markdown",\n            files: ["docs/**"],\n            symbol: "h2",\n            singleEvidencePerSymbol: true,\n          },\n        },\n      ],\n    }],\n  },\n};\n',
  },
  {
    name: "evidence graph ignores an empty rooted typescript claim",
    source:
      'import evidence from "@ttsc/evidence";\n\nexport default {\n  plugins: { "evidence": evidence },\n  rules: {\n    "evidence/graph": ["error", {\n      claims: [\n        {\n          type: "typescript",\n          root: "../shared",\n          files: ["src/**/*.ts"],\n          symbol: "type",\n          reference: { type: "markdown", files: ["docs/**"], symbol: "h2" },\n        },\n      ],\n    }],\n  },\n};\n',
  },
  {
    name: "evidence graph keeps claims independent",
    source:
      'import type { ITtscLintConfig } from "@ttsc/lint";\nimport { evidence } from "@ttsc/evidence";\n\nexport default {\n  plugins: { "evidence": evidence },\n  rules: {\n    "evidence/graph": ["error", {\n      claims: [\n        {\n          type: "typescript",\n          files: ["src/team-a.ts"],\n          symbol: "function",\n          reference: { type: "markdown", files: ["docs/spec.md"], symbol: "h2" },\n        },\n        {\n          type: "typescript",\n          files: ["src/team-b.ts"],\n          symbol: "function",\n          reference: { type: "markdown", files: ["docs/spec.md"], symbol: "h2" },\n        },\n      ],\n    }],\n  },\n} satisfies ITtscLintConfig;\n',
  },
  {
    name: "evidence graph names an unresolvable typescript root",
    source:
      'import evidence from "@ttsc/evidence";\n\nexport default {\n  plugins: { "evidence": evidence },\n  rules: {\n    "evidence/graph": ["error", {\n      claims: [\n        {\n          type: "typescript",\n          root: "../absent",\n          files: ["src/**/*.ts"],\n          symbol: "type",\n          reference: { type: "markdown", files: ["docs/**"], symbol: "h2" },\n        },\n      ],\n    }],\n  },\n};\n',
  },
  {
    name: "evidence graph refuses code evidence to a document",
    source:
      'import type { ITtscLintConfig } from "@ttsc/lint";\nimport { evidence } from "@ttsc/evidence";\n\nexport default {\n  plugins: { "evidence": evidence },\n  rules: {\n    "evidence/graph": ["error", {\n      claims: [{\n        type: "markdown",\n        files: ["docs/**/*.md"],\n        symbol: "file",\n        reference: { type: "typescript", files: ["src/**/*.ts"] },\n      }],\n    }],\n  },\n} satisfies ITtscLintConfig;\n',
  },
  {
    name: "evidence graph reports an exclusion outside its carrier",
    source:
      'import type { ITtscLintConfig } from "@ttsc/lint";\nimport { evidence, type ITtscEvidenceGraphConfig } from "@ttsc/evidence";\n\nconst graph: ITtscEvidenceGraphConfig = {\n  claims: [\n    {\n      name: "operations",\n      type: "typescript",\n      files: ["src/**/*.ts"],\n      symbol: "function",\n      evidenceExcludeCarriers: ["src/LEDGER.ts"],\n      reference: {\n        type: "markdown",\n        files: ["docs/spec.md"],\n        symbol: "h2",\n      },\n    },\n  ],\n};\n\nexport default {\n  plugins: { evidence },\n  rules: { "evidence/graph": ["error", graph] },\n} satisfies ITtscLintConfig;\n',
  },
  {
    name: "evidence graph reports an uncited class",
    source:
      'import evidence from "@ttsc/evidence";\n\nexport default {\n  plugins: { "evidence": evidence },\n  rules: {\n    "evidence/graph": ["error", {\n      claims: [{\n        type: "typescript",\n        files: ["src/Sale.ts"],\n        symbol: "type",\n        reference: {\n          type: "markdown",\n          files: ["docs/subject.md"],\n          symbol: "h2",\n        },\n      }],\n    }],\n  },\n};\n',
  },
  {
    name: "evidence graph reports an unreadable population root",
    source:
      'import evidence from "@ttsc/evidence";\n\nexport default {\n  plugins: { "evidence": evidence },\n  rules: {\n    "evidence/graph": ["error", {\n      claims: [\n        {\n          type: "typescript",\n          files: ["src/**/*.ts"],\n          symbol: "type",\n          reference: {\n            type: "markdown",\n            root: "../documents",\n            files: ["requirements/**"],\n            symbol: "h2",\n          },\n        },\n      ],\n    }],\n  },\n};\n',
  },
  {
    name: "evidence graph reports an unselected exclusion carrier",
    source:
      'import type { ITtscLintConfig } from "@ttsc/lint";\nimport { evidence, type ITtscEvidenceGraphConfig } from "@ttsc/evidence";\n\nconst graph: ITtscEvidenceGraphConfig = {\n  claims: [\n    {\n      name: "operations",\n      type: "typescript",\n      files: ["src/**/*.ts"],\n      evidenceExcludeCarriers: ["vendor/LEDGER.ts"],\n      symbol: "function",\n      reference: {\n        type: "markdown",\n        files: ["docs/spec.md"],\n        symbol: "h2",\n      },\n    },\n  ],\n};\n\nexport default {\n  plugins: { evidence },\n  rules: { "evidence/graph": ["error", graph] },\n} satisfies ITtscLintConfig;\n',
  },
  {
    name: "evidence graph reports declaration failures",
    source:
      'import type { ITtscLintConfig } from "@ttsc/lint";\nimport { evidence } from "@ttsc/evidence";\n\nexport default {\n  plugins: { "evidence": evidence },\n  rules: {\n    "evidence/graph": ["error", {\n      claims: [{\n        type: "typescript",\n        files: ["src/citations.ts"],\n        symbol: "function",\n        reference: {\n          type: "markdown",\n          files: ["docs/spec.md"],\n          symbol: "h2",\n        },\n      }],\n    }],\n  },\n} satisfies ITtscLintConfig;\n',
  },
  {
    name: "evidence graph reports non participating exclusion",
    source:
      'import { evidence } from "@ttsc/evidence";\n\nexport default {\n  plugins: { "evidence": evidence },\n  rules: {\n    "evidence/graph": ["error", { claims: [\n      {\n        name: "first",\n        type: "typescript",\n        files: ["src/first.ts"],\n        symbol: "type",\n        reference: { type: "markdown", files: ["docs/first.md"], symbol: "h2" },\n      },\n      {\n        name: "second",\n        type: "typescript",\n        files: ["src/second.ts"],\n        symbol: "type",\n        reference: { type: "markdown", files: ["docs/second.md"], symbol: "h2" },\n      },\n    ] }],\n  },\n};\n',
  },
];
