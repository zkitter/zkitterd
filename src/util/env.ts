// is ESM
// https://github.com/sindresorhus/is-docker/blob/main/index.js
import fs from 'fs';

let isDockerCached: boolean;

function hasDockerEnv() {
  try {
    fs.statSync('/.dockerenv');
    return true;
  } catch {
    return false;
  }
}

function hasDockerCGroup() {
  try {
    return fs.readFileSync('/proc/self/cgroup', 'utf8').includes('docker');
  } catch {
    return false;
  }
}

function _isDocker() {
  if (isDockerCached === undefined) {
    isDockerCached = hasDockerEnv() || hasDockerCGroup();
  }

  return isDockerCached;
}

const isEnv = (env: string) => process.env.NODE_ENV === env;

export const isDocker = _isDocker();
export const isDev = isEnv('development');
export const isProd = isEnv('production');
export const isTest = isEnv('test');
