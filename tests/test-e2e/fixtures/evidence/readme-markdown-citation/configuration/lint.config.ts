import { evidence } from "@ttsc/evidence";

export default {
  plugins: { "evidence": evidence },
  rules: {
    "evidence/graph": ["error", { claims: [{
      type: "markdown",
      files: ["docs/guides/pricing.md"],
      symbol: "h1",
      reference: { type: "markdown", files: ["docs/requirements/pricing.md"], symbol: "h2" },
    }] }],
  },
};
