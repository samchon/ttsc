const arr: number[] = [1, 2, 3];
// expect: no-array-delete error
delete arr[0];
JSON.stringify(arr);