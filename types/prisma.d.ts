// Minimal PrismaClient type stub to satisfy TypeScript in this project.
// Runtime implementation is provided by the actual `@prisma/client` package.

declare module '@prisma/client' {
  // Use a very loose type here to avoid fighting Prisma's internal typings
  // while still letting us import and use `PrismaClient` in application code.
  class PrismaClient {
    constructor(...args: any[]);
    $connect(): Promise<void>;
    $disconnect(): Promise<void>;
    $on(eventType: string, callback: (...args: any[]) => void): void;
    [key: string]: any;
  }

  export { PrismaClient };
}

