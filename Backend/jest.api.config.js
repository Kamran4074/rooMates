/** @type {import('jest').Config} */
// `npm run test:api` - runs the real Express app against the database in .env.
// Each test file creates its own throwaway users and deletes them afterwards.
module.exports = {
  testEnvironment: "node",
  transform: {
    "^.+\.ts$": "@swc/jest",
  },
  roots: ["<rootDir>/tests"],
  testMatch: ["**/*.test.ts"],
  testTimeout: 30000,
};
