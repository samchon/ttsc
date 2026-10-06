import options from "resident-config-real";
export default {
  extends: "./linked.config.ts",
  rules: { "topology/resident-real": ["error", options] },
};
