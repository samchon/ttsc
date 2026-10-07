module.exports = {
  extends: "./cache-aba/config.cjs",
  rules: {
    "no-console": require("root-boundary-root-main"),
    "no-debugger": require("root-boundary-absent-main"),
    eqeqeq: require("root-boundary-owned-main"),
  },
};
