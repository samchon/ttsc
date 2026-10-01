import evidence from "@ttsc/evidence";

export default {
  plugins: { "evidence": evidence },
  rules: {
    "evidence/graph": ["error", {
      claims: [{
        type: "typescript",
        files: ["src/**/*.ts"],
        reference: { type: "swagger", file: "api/openapi.json" },
      }],
    }],
  },
};
