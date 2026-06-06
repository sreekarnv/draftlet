import { existsSync } from 'node:fs';
import path from 'node:path';
import { MakerDeb } from '@electron-forge/maker-deb';
import { MakerZIP } from '@electron-forge/maker-zip';
import { VitePlugin } from '@electron-forge/plugin-vite';

const bundledServerDir = path.resolve(__dirname, '../server/dist/draftlet-server');
const extraResource = existsSync(bundledServerDir) ? [bundledServerDir] : [];

const config = {
  packagerConfig: {
    executableName: 'draftlet',
    extraResource,
  },
  rebuildConfig: {},
  makers: [
    new MakerZIP({}, ['darwin', 'linux', 'win32']),
    new MakerDeb({
      options: {
        maintainer: 'Draftlet',
        name: 'draftlet',
        productName: 'Draftlet',
        genericName: 'Draftlet',
        bin: 'draftlet',
        description: 'Desktop companion for setting up and running Draftlet locally.',
        categories: ['Utility'],
      },
    }),
  ],
  plugins: [
    new VitePlugin({
      build: [
        {
          entry: 'src/main/index.ts',
          config: 'vite.main.config.ts',
        },
        {
          entry: 'src/preload/preload.ts',
          config: 'vite.preload.config.ts',
        },
      ],
      renderer: [
        {
          name: 'main_window',
          config: 'vite.renderer.config.ts',
        },
      ],
    }),
  ],
};

export default config;
