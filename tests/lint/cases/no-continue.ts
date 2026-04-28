for (let i = 0; i < 3; i++) {
  // expect: no-continue error
  if (i === 1) continue;
  console.log(i);
}
