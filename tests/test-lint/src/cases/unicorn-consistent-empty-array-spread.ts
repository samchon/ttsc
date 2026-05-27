declare const cond: boolean;
declare const x: number;
// expect: unicorn/consistent-empty-array-spread error
const a = [1, ...(cond ? [x] : 2 as unknown as number[])];
void a;
