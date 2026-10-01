declare const require: { main: unknown };
declare const module: unknown;
declare const process: { argv: string[] };
console.log(JSON.stringify({ main: require.main === module, argv1: process.argv[1] }));
export {};
