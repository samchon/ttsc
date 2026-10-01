const arr: number[] = [1, 2, 3];
// expect: prefer-for-of error
for (let i = 0; i < arr.length; i++) {
  console.log(arr[i]);
}
