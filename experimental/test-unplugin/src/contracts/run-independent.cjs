/** Finish every independent task with bounded concurrency and ordered failures. */
async function runIndependent(tasks, execute, concurrency = 1) {
  const failed = new Array(tasks.length).fill(false);
  let cursor = 0;
  await Promise.all(
    Array.from({ length: Math.min(concurrency, tasks.length) }, async () => {
      while (cursor < tasks.length) {
        const index = cursor++;
        try {
          failed[index] = (await execute(tasks[index], index)) !== 0;
        } catch (error) {
          console.error(error);
          failed[index] = true;
        }
      }
    }),
  );
  return tasks.filter((_, index) => failed[index]);
}

module.exports = { runIndependent };
