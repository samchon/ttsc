const arr: number[] = [1, 2, 3];
// expect: noArrayDelete error
delete arr[0];
JSON.stringify(arr);
