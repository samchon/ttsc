declare module "node:sqlite" { export class DatabaseSync { constructor(location: string); close(): void; } }
