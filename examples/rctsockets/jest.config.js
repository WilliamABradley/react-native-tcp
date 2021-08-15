module.exports = {
  preset: 'react-native',
  testEnvironment: 'jsdom',
  transformIgnorePatterns: [
    '<rootDir>/node_modules/(react-clone-referenced-element|@react-native-community|react-navigation|@react-navigation/.*|@unimodules/.*|native-base|react-native-code-push)',
  ],
  testPathIgnorePatterns: ['<rootDir>/node_modules/', '\\.snap$'],
};