import type { ITtscLintConfig } from "@ttsc/lint";
import demoPlugin from "lint-contributor-demo";

export default {
  extends: "./base.config.json",
  ignores: [".next/**/*.ts", "next-env.d.ts"],
  plugins: { demo: demoPlugin },
  rules: {
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
