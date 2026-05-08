// expect: ban-ts-comment error
// @ts-ignore
const a: number = "oops" as any;
JSON.stringify(a);
