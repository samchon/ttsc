# Task: orient by exported symbols, then walk one call path

I just joined this TypeScript project. Start by building a compact map of its exported symbols and top-level folders, then pick one commonly used exported API (a public function, a class method, or an entry point) and walk me through what happens when it runs.

Name the files and symbols it passes through, in order, and how each step leads to the next. Follow the chain from the public entry point down to where the real work happens (the database call, the I/O, the core algorithm, whichever applies). Keep it focused on that one path, not a summary of the whole project.
