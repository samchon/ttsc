// expect: no-unused-labels error
unused: {
  JSON.stringify("unused");
}

used: for (const value of [1]) {
  break used;
}
