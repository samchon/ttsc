Compiler diagnostics: TypeScript type errors, plus the project's @ttsc/lint rule violations and transform-plugin (typia, nestia) findings when present, each with its code and location exactly as ttsc reports them.

Pass `files` for specific files, each answered as its own block, or omit it for every current finding across the project, grouped by file. Use the whole-project form after an edit to see what is now broken.

Reports errors by default. Pass `severity` as `warning` for warnings only, or `all` for both.
