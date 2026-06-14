import { SERVER_BASE_URL } from '../constants';
import type { PreferenceItem, PreferenceUpsert } from '../types';
import { getJson } from './transport';

export async function getPreferences(scope?: string, signal?: AbortSignal): Promise<PreferenceItem[]> {
  const query = scope ? `?scope=${encodeURIComponent(scope)}` : '';
  return getJson<PreferenceItem[]>(`${SERVER_BASE_URL}/preferences${query}`, signal);
}

export async function putPreference(preference: PreferenceUpsert): Promise<PreferenceItem> {
  const response = await fetch(`${SERVER_BASE_URL}/preferences`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(preference),
  });

  if (!response.ok) {
    throw new Error(`Preference request failed with ${response.status}`);
  }

  return response.json() as Promise<PreferenceItem>;
}
