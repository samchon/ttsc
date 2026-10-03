const xs = [1, 2, 3];
// expect: unicorn/no-for-loop error
for (let i = 0; i < xs.length; i++) { void xs[i]; }
