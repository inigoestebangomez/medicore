import type { Config } from 'jest';

const moduleNameMapper = {
  '^@/(.*)$': '<rootDir>/src/$1',
};

const config: Config = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testMatch: ['**/*.spec.ts'],
  transform: {
    '^.+\\.(t|j)s$': ['ts-jest', { tsconfig: 'tsconfig.json' }],
  },
  collectCoverageFrom: ['src/**/*.(t|j)s', '!src/**/*.module.ts', '!src/main.ts'],
  coverageDirectory: './coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  testEnvironment: 'node',
  moduleNameMapper,
  projects: [
    {
      displayName: 'unit',
      testMatch: ['**/*.spec.ts'],
      testPathIgnorePatterns: ['/node_modules/', '/dist/', '\\.integration\\.spec\\.ts$'],
      transform: {
        '^.+\\.(t|j)s$': ['ts-jest', { tsconfig: 'tsconfig.json' }],
      },
      setupFilesAfterEnv: ['<rootDir>/test/setup-unit.ts'],
      moduleNameMapper,
    },
    {
      displayName: 'integration',
      testMatch: ['**/*.integration.spec.ts'],
      transform: {
        '^.+\\.(t|j)s$': ['ts-jest', { tsconfig: 'tsconfig.json' }],
      },
      setupFilesAfterEnv: ['<rootDir>/test/setup-integration.ts'],
      globalSetup: '<rootDir>/test/global-setup.ts',
      globalTeardown: '<rootDir>/test/global-teardown.ts',
      moduleNameMapper,
    },
  ],
};

export default config;