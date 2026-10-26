// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');
const fs = require('fs');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Prefer ./shared (bundled copy for EAS Build) over ../shared (monorepo sibling for local dev)
const localShared = path.resolve(__dirname, 'shared');
const siblingShared = path.resolve(__dirname, '../shared');
const sharedPath = fs.existsSync(localShared)
  ? localShared
  : fs.existsSync(siblingShared)
    ? siblingShared
    : null;

if (sharedPath) {
  config.resolver.extraNodeModules = {
    ...config.resolver.extraNodeModules,
    '@shared': sharedPath,
  };
  config.watchFolders = [
    ...(config.watchFolders ?? []),
    sharedPath,
  ];
}

// This worktree has no node_modules of its own (it lives under /tmp and shares the
// main repo's git history). Resolve all packages from the main repo's node_modules so
// `eas update` can bundle locally even after /tmp is cleaned. The EAS *build* installs
// deps server-side from this worktree's package.json, so this only affects OTA bundling.
const mainNodeModules = path.resolve('/home/ubuntu/Downloads/WeApp/mobile/node_modules');
if (fs.existsSync(mainNodeModules)) {
  config.resolver.nodeModulesPaths = [
    mainNodeModules,
    ...(config.resolver.nodeModulesPaths ?? []),
  ];
  config.watchFolders = [
    ...(config.watchFolders ?? []),
    mainNodeModules,
  ];
}

module.exports = config;
