/** @type {import('jest').Config} */
// `npm run test:api` - runs the real Express app against a LOCAL database.
// Each test file creates its own throwaway users and deletes them afterwards.
// guardDatabase stops the run if DATABASE_URL isn't local (e.g. production).
module.exports = {
  testEnvironment: "node",
  transform: {
    "^.+\.ts$": "@swc/jest",
  },
  roots: ["<rootDir>/tests"],
  testMatch: ["**/*.test.ts"],
  testTimeout: 30000,
  globalSetup: "<rootDir>/tests/guardDatabase.js",
};
