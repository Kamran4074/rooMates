/** @type {import('jest').Config} */
// `npm test` - fast unit tests, no database needed.
module.exports = {
  testEnvironment: "node",
  transform: {
    "^.+\.ts$": "@swc/jest",
  },
  roots: ["<rootDir>/src"],
  testMatch: ["**/*.test.ts"],
};
