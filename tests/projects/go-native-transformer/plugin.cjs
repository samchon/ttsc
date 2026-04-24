module.exports = {
  name: "go-native-transformer-test",
  native: {
    mode: "go-native-transformer-test",
    binary: process.env.TTSC_GO_TRANSFORMER_BINARY,
    contractVersion: 1,
    capabilities: ["transform"],
  },
};
