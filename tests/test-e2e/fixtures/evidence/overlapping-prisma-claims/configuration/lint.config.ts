import { evidence } from "@ttsc/evidence";

export default {
  plugins: { "evidence": evidence },
  rules: {
    "evidence/graph": ["error", { claims: [
      {
        name: "DTO models",
        type: "typescript",
        files: ["src/structures/**/*.ts"],
        symbol: "type",
        reference: { type: "prisma", files: ["prisma/**/*.prisma"], symbol: "model" },
      },
      {
        name: "DTO columns",
        type: "typescript",
        files: ["src/structures/**/*.ts"],
        symbol: "property",
        reference: { type: "prisma", files: ["prisma/**/*.prisma"], symbol: "column" },
      },
    ] }],
  },
};
