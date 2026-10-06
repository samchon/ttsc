import type { ITtscLintConfig } from "@ttsc/lint";
import demoPlugin from "lint-contributor-demo";

export default {
  extends: "./base.config.json",
  plugins: { demo: demoPlugin },
  rules: {
    "no-debugger": "error",
    "typescript/no-explicit-any": "error",
    "demo/no-todo-comment": "error",
    "demo/no-marker-comment": ["error", { markers: ["XXX"] }],
    "typescript/no-restricted-types": [
      "error",
      {
        types: {
          Legacy: {
            message: "Use Safe instead.",
            fixWith: "Safe",
            suggest: ["Safer"],
          },
        },
      },
    ],
  },
} satisfies ITtscLintConfig;
