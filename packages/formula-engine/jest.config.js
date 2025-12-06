/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  moduleNameMapper: {
    '^@jasheets/shared$': '<rootDir>/../shared/src/index.ts',
    '^@/(.*)$': '<rootDir>/src/$1',
  },
};
