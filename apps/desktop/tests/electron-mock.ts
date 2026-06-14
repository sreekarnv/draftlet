import { vi } from 'vitest';

export const ipcMainHandle = vi.fn();
export const ipcMainRemoveHandler = vi.fn();

export const ipcMain = {
  handle: ipcMainHandle,
  removeHandler: ipcMainRemoveHandler,
};

export const appGetPath = vi.fn();

export const app = {
  getPath: appGetPath,
};

vi.mock('electron', () => ({
  ipcMain,
  app,
}));
