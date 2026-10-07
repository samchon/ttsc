import type { ITtscLintConfig } from "@ttsc/lint";
import demoPlugin from "lint-contributor-demo";

export default {
  plugins: { demo: demoPlugin },
  rules: {
    "demo/no-todo-comment": "error",
    "demo/no-marker-comment": ["error", { markers: ["XXX"] }],
  },
} satisfies ITtscLintConfig;
