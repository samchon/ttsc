// expect: no-sparse-arrays error
const a = [1, , 3];
JSON.stringify(a);
