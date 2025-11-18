module.exports = {
  displayName: 'Frontend Integration Tests',
  testEnvironment: 'node',
  testMatch: ['**/*.test.ts'],
  preset: 'ts-jest',
  globals: {
    'ts-jest': {
      tsconfig: {
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
      },
    },
  },
  setupFilesAfterEnv: ['./setup.ts'],
  verbose: true,
  bail: false,
  maxWorkers: 1,
};
