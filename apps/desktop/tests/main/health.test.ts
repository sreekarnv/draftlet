import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ipcMainHandle, appGetPath } from '../electron-mock';

vi.mock('electron', () => ({
  ipcMain: { handle: ipcMainHandle, removeHandler: vi.fn() },
  app: { getPath: appGetPath },
}));

import {
  checkHttpStatus,
  checkServerHealth,
  isDraftletHealth,
  registerHealthIpc,
} from '../../src/main/ipc/health';

const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

beforeEach(() => {
  fetchMock.mockReset();
  ipcMainHandle.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('isDraftletHealth', () => {
  it('returns true only when status, service, and app match Draftlet', () => {
    expect(isDraftletHealth({ status: 'healthy', service: 'draftlet-server', app: 'draftlet' })).toBe(true);
  });

  it('returns false when any field does not match', () => {
    expect(isDraftletHealth({ status: 'ok', service: 'draftlet-server', app: 'draftlet' })).toBe(false);
    expect(isDraftletHealth({ status: 'healthy', service: 'other', app: 'draftlet' })).toBe(false);
    expect(isDraftletHealth({ status: 'healthy', service: 'draftlet-server', app: 'other' })).toBe(false);
    expect(isDraftletHealth({})).toBe(false);
  });
});

describe('checkServerHealth', () => {
  it('returns ready when the server reports Draftlet health', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({
      status: 'healthy',
      service: 'draftlet-server',
      app: 'draftlet',
      version: '0.1.1',
    }));

    const result = await checkServerHealth();

    expect(result).toMatchObject({ ok: true, code: 'ready' });
    expect(result.message).toContain('0.1.1');
  });

  it('returns an error when the response is not ok', async () => {
    fetchMock.mockResolvedValueOnce(new Response('Internal Server Error', { status: 500 }));

    const result = await checkServerHealth();

    expect(result.ok).toBe(false);
    expect(result.code).toBe('error');
    expect(result.message).toContain('500');
  });

  it('returns conflict when the response is ok but not Draftlet', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ status: 'ok', service: 'something-else' }));

    const result = await checkServerHealth();

    expect(result.ok).toBe(false);
    expect(result.code).toBe('conflict');
  });

  it('returns offline when fetch throws', async () => {
    fetchMock.mockRejectedValueOnce(new Error('socket closed'));

    const result = await checkServerHealth();

    expect(result.ok).toBe(false);
    expect(result.code).toBe('offline');
    expect(result.message).toContain('socket closed');
  });
});

describe('checkHttpStatus', () => {
  it('returns ready on a 2xx response', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 200 }));

    const result = await checkHttpStatus('http://127.0.0.1:11434/api/tags', 'Ollama is up', 'Ollama');

    expect(result.ok).toBe(true);
    expect(result.code).toBe('ready');
  });

  it('returns error with the status code on a non-2xx response', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 503 }));

    const result = await checkHttpStatus('http://127.0.0.1:11434/api/tags', 'Ollama is up', 'Ollama');

    expect(result.ok).toBe(false);
    expect(result.code).toBe('error');
    expect(result.message).toContain('503');
  });

  it('returns not_running when the request fails', async () => {
    fetchMock.mockRejectedValueOnce(new Error('econnrefused'));

    const result = await checkHttpStatus('http://127.0.0.1:11434/api/tags', 'Ollama is up', 'Ollama');

    expect(result.ok).toBe(false);
    expect(result.code).toBe('not_running');
    expect(result.message).toContain('econnrefused');
  });
});

describe('registerHealthIpc', () => {
  it('registers the draftlet:check-server-health handler', () => {
    registerHealthIpc();

    expect(ipcMainHandle).toHaveBeenCalledWith('draftlet:check-server-health', expect.any(Function));
  });
});
