import { execFile, spawn, type ChildProcess } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import { app, ipcMain } from 'electron';

import { checkServerHealth } from './health.js';
import { DRAFTLET_SERVER_PORT, fail, getSelectedModelSetting, ok, RECOMMENDED_MODEL, type CommandStatus } from './settings.js';

interface ServerStartCommand {
  command: string;
  args: string[];
  cwd: string;
  env?: NodeJS.ProcessEnv;
  mode: 'bundled' | 'development';
}

const execFileAsync = promisify(execFile);
let serverProcess: ChildProcess | null = null;

export function registerServerIpc() {
  ipcMain.handle('draftlet:start-server', () => startDraftletServer());
  ipcMain.handle('draftlet:stop-server', () => stopDraftletServer());
}

export async function startDraftletServer(): Promise<CommandStatus> {
  const selectedModel = await getSelectedModelSetting() ?? RECOMMENDED_MODEL;
  const health = await checkServerHealth();

  if (health.ok) {
    return ok('Draftlet server is already responding.', 'ready');
  }

  if (health.code === 'conflict' || await hasProcessOnDraftletPort()) {
    return fail(`Port ${DRAFTLET_SERVER_PORT} is occupied by a non-Draftlet process. Stop that process or change its port before starting Draftlet.`, 'conflict');
  }

  if (serverProcess && serverProcess.exitCode === null) {
    return ok('Draftlet server is already starting.', 'starting');
  }

  const startCommand = buildServerStartCommand();
  const child = spawn(startCommand.command, startCommand.args, {
    cwd: startCommand.cwd,
    env: {
      ...process.env,
      ...startCommand.env,
      DRAFTLET_OLLAMA_MODEL: selectedModel,
      DRAFTLET_SERVER_PORT: String(DRAFTLET_SERVER_PORT),
    },
    stdio: 'ignore',
    windowsHide: true,
  });

  child.once('exit', () => {
    serverProcess = null;
  });
  serverProcess = child;

  return ok(`Draftlet server start requested (${startCommand.mode}).`, 'starting');
}

export async function stopDraftletServer(): Promise<CommandStatus> {
  if (serverProcess && serverProcess.exitCode === null) {
    serverProcess.kill();
    serverProcess = null;
    return ok('Managed Draftlet server stopped.', 'stopped');
  }

  const health = await checkServerHealth();

  if (!health.ok) {
    if (health.code === 'conflict') {
      return fail('A non-Draftlet service is on the Draftlet port. Draftlet will not stop it.', 'conflict');
    }

    return ok('No Draftlet server is running.', 'stopped');
  }

  const pids = await findProcessIdsOnDraftletPort();

  if (pids.length === 0) {
    return fail('Draftlet server identified itself, but no owning process could be found for the port.', 'error');
  }

  await stopProcesses(pids);
  return ok(`Stopped Draftlet server process${pids.length > 1 ? 'es' : ''}: ${pids.join(', ')}.`, 'stopped');
}

function buildServerStartCommand(): ServerStartCommand {
  const bundledServerExecutable = getBundledServerExecutable();

  if (app.isPackaged && bundledServerExecutable) {
    return {
      command: bundledServerExecutable,
      args: [],
      cwd: path.dirname(bundledServerExecutable),
      env: {
        DRAFTLET_DATABASE_URL: `sqlite:///${path.join(app.getPath('userData'), 'draftlet.db')}`,
      },
      mode: 'bundled',
    };
  }

  const serverDir = path.resolve(process.cwd(), '../server');

  return {
    command: 'uv',
    args: ['run', 'uvicorn', 'app.main:app', '--host', '127.0.0.1', '--port', String(DRAFTLET_SERVER_PORT)],
    cwd: serverDir,
    mode: 'development',
  };
}

function getBundledServerExecutable(): string | null {
  const executableName = process.platform === 'win32' ? 'draftlet-server.exe' : 'draftlet-server';
  const executablePath = path.join(process.resourcesPath, 'draftlet-server', executableName);

  return existsSync(executablePath) ? executablePath : null;
}

async function hasProcessOnDraftletPort(): Promise<boolean> {
  return (await findProcessIdsOnDraftletPort()).length > 0;
}

async function findProcessIdsOnDraftletPort(): Promise<number[]> {
  try {
    if (process.platform === 'win32') {
      const { stdout } = await execFileAsync('netstat', ['-ano', '-p', 'tcp']);
      return Array.from(new Set(stdout
        .split('\n')
        .filter((line) => line.includes(`127.0.0.1:${DRAFTLET_SERVER_PORT}`) && /LISTENING/i.test(line))
        .map((line) => Number(line.trim().split(/\s+/).at(-1)))
        .filter((pid) => Number.isInteger(pid) && pid > 0)));
    }

    return await findPosixProcessIdsWithLsof();
  } catch {
    return findPosixProcessIdsWithSs();
  }
}

async function findPosixProcessIdsWithLsof(): Promise<number[]> {
  const { stdout } = await execFileAsync('lsof', ['-nP', `-iTCP:${DRAFTLET_SERVER_PORT}`, '-sTCP:LISTEN', '-t']);

  return uniquePids(stdout
    .split('\n')
    .map((line) => Number(line.trim())));
}

async function findPosixProcessIdsWithSs(): Promise<number[]> {
  try {
    const { stdout } = await execFileAsync('ss', ['-ltnp', `sport = :${DRAFTLET_SERVER_PORT}`]);
    const pids = Array.from(stdout.matchAll(/pid=(\d+)/g)).map((match) => Number(match[1]));
    return uniquePids(pids);
  } catch {
    return [];
  }
}

function uniquePids(pids: number[]): number[] {
  return Array.from(new Set(pids.filter((pid) => Number.isInteger(pid) && pid > 0)));
}

async function stopProcesses(pids: number[]): Promise<void> {
  if (process.platform === 'win32') {
    await Promise.all(pids.map((pid) => execFileAsync('taskkill', ['/PID', String(pid), '/T', '/F']).catch(() => undefined)));
    return;
  }

  await Promise.all(pids.map((pid) => execFileAsync('kill', ['-TERM', String(pid)]).catch(() => undefined)));
}
