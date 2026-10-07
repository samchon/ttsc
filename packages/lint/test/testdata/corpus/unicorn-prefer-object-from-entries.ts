const entries: Array<[string, number]> = [["a", 1]];
// expect: unicorn/prefer-object-from-entries error
const obj = entries.reduce((acc, [k, v]) => ({ ...acc, [k]: v }), {});
void obj;
