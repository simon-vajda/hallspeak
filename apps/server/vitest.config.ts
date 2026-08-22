import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // The server is built on process-wide singletons — `db`, `core/auth`, `core/media`,
    // `core/presence` — so two test files sharing a worker share all of them. That was
    // harmless while every file only added rows; it stopped being harmless once completing
    // setup began emptying the session table out from under another file's session.
    fileParallelism: false,
  },
});
