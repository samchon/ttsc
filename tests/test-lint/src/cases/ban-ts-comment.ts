// expect: banTsComment error
// @ts-ignore
const a: number = "oops" as any;
JSON.stringify(a);
