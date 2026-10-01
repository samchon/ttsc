import type { ITtscLintConfig } from "@ttsc/lint";
import { evidence, type ITtscEvidenceGraphConfig } from "@ttsc/evidence";

const graph: ITtscEvidenceGraphConfig = {
  claims: [
    {
      name: "schema-models",
      type: "prisma",
      files: ["prisma/**/*.prisma", "prisma/exclude.schema"],
      symbol: "model",
      reference: {
        type: "markdown",
        files: ["docs/schema.md"],
        symbol: "h2",
      },
    },
    {
      name: "api-operations",
      type: "typescript",
      files: ["src/controllers/**/*.ts"],
      symbol: "function",
      reference: [
        {
          type: "markdown",
          files: ["docs/controller.md"],
          symbol: "h2",
        },
        {
          type: "prisma",
          files: ["prisma/**/*.prisma"],
          symbol: "model",
        },
      ],
    },
    {
      name: "dto-types",
      type: "typescript",
      files: ["src/structures/**/*.ts"],
      symbol: "type",
      reference: {
        type: "markdown",
        files: ["docs/dto.md"],
        symbol: "h2",
      },
    },
    {
      name: "dto-properties",
      type: "typescript",
      files: ["src/structures/**/*.ts"],
      symbol: "property",
      reference: {
        type: "prisma",
        files: ["prisma/**/*.prisma"],
        symbol: "column",
      },
    },
    {
      name: "backend-tests",
      type: "typescript",
      files: ["src/tests/**/*.ts"],
      symbol: "function",
      reference: [
        {
          type: "markdown",
          files: ["docs/test.md"],
          symbol: "h2",
        },
        {
          type: "typescript",
          files: ["src/contracts.ts"],
          symbol: "function",
        },
        {
          type: "typescript",
          files: ["src/contracts.ts"],
          symbol: "type",
        },
      ],
    },
  ],
};

export default {
  plugins: { evidence },
  rules: { "evidence/graph": ["error", graph] },
} satisfies ITtscLintConfig;
