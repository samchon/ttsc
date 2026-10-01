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
            files: ["docs/reference.md"],
            symbol: "h2",
          },
        },
        {
          type: "markdown",
          files: ["docs/claim.md"],
          symbol: "h2",
          reference: {
            type: "prisma",
            files: ["prisma/schema/main.prisma"],
            symbol: "model",
          },
        },
        {
          type: "prisma",
          files: ["prisma/schema/main.prisma"],
          symbol: "model",
          reference: {
            type: "markdown",
            files: ["docs/reference.md"],
            symbol: "h2",
          },
        },
      ],
    }],
  },
};
