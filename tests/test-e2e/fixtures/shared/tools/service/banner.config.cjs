// The relative environment value selects the real evaluator executable;
// the banner reports that evaluator's physical executable, not the input text.
module.exports = { text: require("node:fs").realpathSync.native(process.execPath) };
