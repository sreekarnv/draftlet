import { spawn } from 'node:child_process';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { MakerDeb } from '@electron-forge/maker-deb';
import { MakerZIP } from '@electron-forge/maker-zip';
import { VitePlugin } from '@electron-forge/plugin-vite';
import { MakerAppImage } from '@reforged/maker-appimage';

import type { ForgeConfig } from '@electron-forge/shared-types';

const logPrefix = '[draftlet:forge]';
const localRequire = createRequire(__filename);
const bundledServerDir = path.resolve(__dirname, '../server/dist/draftlet-server');
const rootDir = path.resolve(__dirname, "../..");
const iconPng = path.join(rootDir, "apps/desktop/assets/icon.png");
const bundledServerExecutableName = process.platform === 'win32' ? 'draftlet-server.exe' : 'draftlet-server';

/**
 * Node 24 currently freezes in Electron Packager's default Electron ZIP
 * extraction path on this project. Manual system `unzip` extracts the same
 * Electron archive successfully, so we patch Packager's extractor on
 * Linux/macOS only.
 */
const patchElectronPackagerUnzip = (): void => {
  const platformUsesSystemUnzip =
    process.platform === 'linux' || process.platform === 'darwin';

  if (!platformUsesSystemUnzip) {
    console.log(
      `${logPrefix} Using Electron Packager's default Electron ZIP extractor on ${process.platform}.`,
    );
    return;
  }

  try {
    const unzipModulePath = localRequire.resolve('@electron/packager/dist/unzip.js');

    type UnzipModule = {
      extractElectronZip: (zipPath: string, targetDir: string) => Promise<void>;
    };

    const unzipModule = localRequire(unzipModulePath) as UnzipModule;

    unzipModule.extractElectronZip = async (
      zipPath: string,
      targetDir: string,
    ): Promise<void> => {
      await new Promise<void>((resolve, reject) => {
        const child = spawn('unzip', ['-q', '-o', zipPath, '-d', targetDir], {
          stdio: ['ignore', 'inherit', 'inherit'],
        });

        child.once('error', reject);
        child.once('close', (code, signal) => {
          if (code === 0) {
            resolve();
            return;
          }

          reject(
            new Error(
              signal
                ? `System unzip was terminated by signal ${signal} while extracting ${zipPath}`
                : `System unzip exited with code ${code ?? 'unknown'} while extracting ${zipPath}`,
            ),
          );
        });
      });
    };

    console.log(
      `${logPrefix} Patched Electron Packager to extract Electron ZIPs with system unzip.`,
    );
  } catch (error) {
    console.warn(
      `${logPrefix} Could not patch Electron Packager unzip path: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    console.warn(`${logPrefix} Falling back to Electron Packager's default extractor.`);
  }
};

patchElectronPackagerUnzip();

const resolveExtraResource = (): string[] => {
  if (!existsSync(bundledServerDir)) {
    throw new Error(
      `${logPrefix} No bundled server at ${bundledServerDir}. Run scripts/build-server.sh before packaging the desktop app.`,
    );
  }

  const stats = statSync(bundledServerDir);
  const entries = stats.isDirectory() ? readdirSync(bundledServerDir) : [];

  if (!stats.isDirectory() || entries.length === 0) {
    throw new Error(
      `${logPrefix} Bundled server directory is missing or empty. Run scripts/build-server.sh before packaging the desktop app.`,
    );
  }

  const executablePath = path.join(bundledServerDir, bundledServerExecutableName);

  if (!existsSync(executablePath)) {
    throw new Error(
      `${logPrefix} Bundled server executable missing at ${executablePath}. Run scripts/build-server.sh before packaging the desktop app.`,
    );
  }

  console.log(`${logPrefix} Bundling server from ${bundledServerDir}.`);
  return [bundledServerDir];
};

const includeDebMaker = process.env.DRAFTLET_MAKE_DEB === '1';
const includeAppImageMaker = process.env.DRAFTLET_MAKE_APPIMAGE === '1';

console.log(
  `${logPrefix} MakerDeb ${
    includeDebMaker ? 'enabled.' : 'disabled. Set DRAFTLET_MAKE_DEB=1 to enable.'
  }`,
);

console.log(
  `${logPrefix} MakerAppImage ${
    includeAppImageMaker
      ? 'enabled.'
      : 'disabled. Set DRAFTLET_MAKE_APPIMAGE=1 to enable.'
  }`,
);

const makers: ForgeConfig['makers'] = [
  new MakerZIP({}, ['darwin', 'linux', 'win32']),
  ...(includeDebMaker
    ? [
        new MakerDeb({
          options: {
            maintainer: 'Draftlet',
            name: 'draftlet',
            productName: 'Draftlet',
            genericName: 'Draftlet',
            bin: 'draftlet',
            description: 'Desktop companion for setting up and running Draftlet locally.',
            categories: ['Utility'],
            icon: iconPng,
          },
        }),
      ]
    : []),
  ...(includeAppImageMaker
    ? [
        new MakerAppImage({
          options: {
            bin: 'draftlet',
            productName: 'Draftlet',
            genericName: 'Draftlet',
            categories: ['Utility'],
            icon: iconPng
          },
        }),
      ]
    : []),
];

const config: ForgeConfig = {
  packagerConfig: {
    name: 'Draftlet',
    executableName: 'draftlet',
    extraResource: resolveExtraResource(),
    prune: false,
  },
  rebuildConfig: {},
  makers,
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
