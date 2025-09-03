/**
 * Jest configuration for the API test project.
 *
 * I keep the configuration simple here: using the Node test environment and
 * enabling verbose output so that individual test results are printed.
 */
module.exports = {
  testEnvironment: 'node',
  verbose: true,
  collectCoverage: false
};