import { SERVER_BASE_URL } from '../constants';

export async function checkServerHealth(signal?: AbortSignal): Promise<boolean> {
  try {
    const response = await fetch(`${SERVER_BASE_URL}/health`, {
      headers: { Accept: 'application/json' },
      signal,
    });

    return response.ok;
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw error;
    }

    return false;
  }
}
