function process(items: number[]): number {
  let total = 0;
  let count = 0;
  if (items.length > 0) {
    for (const item of items) {
      const doubled = item * 2;
      total += doubled;
      count += 1;
      {
        const note = count;
        total += note;
      }
    }
  }
  return total;
}
