import evidence from "@ttsc/evidence";

export default {
  plugins: { "evidence": evidence },
  rules: {
    "evidence/graph": ["error", {
      claims: [
        {
          type: "typescript",
          files: ["src/**/*.ts"],
          symbol: "function",
          reference: {
            type: "markdown",
            root: "missing-typescript-docs",
            files: ["**/*.md"],
            symbol: "h2",
          },
        },
        {
          type: "markdown",
          files: ["docs/claim.md"],
          symbol: "h2",
          reference: {
            type: "prisma",
            root: "missing-markdown-prisma",
            files: ["**/*.prisma"],
            symbol: "model",
          },
        },
        {
          type: "prisma",
          files: ["prisma/schema/main.prisma"],
          symbol: "model",
          reference: {
            type: "markdown",
            root: "missing-prisma-docs",
            files: ["**/*.md"],
            symbol: "h2",
          },
        },
      ],
    }],
  },
};
