export const readDebugFlag = (): boolean => {
  const importMetaEnv = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env;
  const importMetaValue = importMetaEnv?.DRAFTLET_DEBUG_INSERTION;
  const processValue = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env
    ?.DRAFTLET_DEBUG_INSERTION;
  return importMetaValue === '1' || processValue === '1';
};
