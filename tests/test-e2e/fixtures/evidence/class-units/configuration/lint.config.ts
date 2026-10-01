import evidence from "@ttsc/evidence";

export default {
  plugins: { "evidence": evidence },
  rules: {
    "evidence/graph": ["error", {
      claims: [{
        type: "typescript",
        files: ["src/Sale.ts"],
        symbol: "type",
        reference: {
          type: "markdown",
          files: ["docs/subject.md"],
          symbol: "h2",
        },
      }, {
        type: "typescript",
        files: ["src/Sale.ts"],
        symbol: "property",
        reference: {
          type: "markdown",
          files: ["docs/fields.md"],
          symbol: "h2",
        },
      }],
    }],
  },
};
