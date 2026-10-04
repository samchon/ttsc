const { evidence } = require("@ttsc/evidence");
module.exports = {
  plugins: { evidence },
  rules: {
    "no-var": "error",
    "evidence/graph": ["error", {
      claims: [{ type: "typescript", files: ["src/contract.ts"], symbol: "function", reference: { type: "markdown", files: ["docs/contract.md"], symbol: "h2" } }]
    }]
  }
};
