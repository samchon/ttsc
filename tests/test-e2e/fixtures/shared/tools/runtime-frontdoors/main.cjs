const dependency = require("./src/dep.js");
console.log(JSON.stringify({ main: require.main === module, value: dependency.value, argv: process.argv.slice(2) }));
