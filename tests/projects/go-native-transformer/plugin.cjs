const path = require("node:path");

module.exports = {
  name: "go-native-transformer-test",
  source:
    process.env.TTSC_GO_TRANSFORMER_SOURCE ??
    path.resolve(__dirname, "go-transformer", "cmd", "ttsc-go-transformer"),
};
