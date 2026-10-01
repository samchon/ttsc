import { evidence } from "@ttsc/evidence";

export default {
  plugins: { "evidence": evidence },
  rules: {
    "evidence/singular": "error",
  },
};
