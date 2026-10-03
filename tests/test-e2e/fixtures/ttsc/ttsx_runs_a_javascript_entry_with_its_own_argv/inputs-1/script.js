const { value } = require("./src/config.js");
console.log(JSON.stringify({ argv: process.argv.slice(2), main: require.main === module, value }));
