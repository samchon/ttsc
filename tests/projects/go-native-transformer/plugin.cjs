const path = require("node:path");

module.exports = (context) => ({
  name: "go-native-transformer-test",
  source:
    process.env.TTSC_GO_TRANSFORMER_SOURCE ??
    path.resolve(
      context.dirname,
      "go-transformer",
      "cmd",
      "ttsc-go-transformer",
    ),
});
