const path = require('path');
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

const projectRoot = __dirname;
const contractsRoot = path.resolve(projectRoot, '../../packages/contracts');

/**
 * @type {import('@react-native/metro-config').MetroConfig}
 */
const config = {
  watchFolders: [contractsRoot],
  resolver: {
    unstable_enableSymlinks: true,
    nodeModulesPaths: [path.resolve(projectRoot, 'node_modules')],
    extraNodeModules: {
      '@hiihive/contracts': contractsRoot,
    },
  },
};

module.exports = mergeConfig(getDefaultConfig(projectRoot), config);
