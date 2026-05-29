/* eslint-disable */
// @ts-check
const { serwist } = require('@serwist/next/config')
const { execSync } = require('child_process')

const revision = execSync('git rev-parse HEAD', { encoding: 'utf-8' }).trim() || '1'

/** @type {import('@serwist/next/config').SerwistConfig} */
module.exports = serwist({
  swSrc: 'src/app/sw.ts',
  swDest: 'public/sw.js',
  reloadOnOnline: true,
  cacheOnNavigation: true,
  disable: process.env.NODE_ENV === 'development',
  additionalPrecacheEntries: [
    { url: '/~offline', revision },
  ],
})
