import PocketBase from 'pocketbase';
import type { Game, Point } from './types';

// Use environment variable or fallback to localhost
export const PB_URL = import.meta.env.VITE_POCKETBASE_URL || 'http://127.0.0.1:8090';

export const pb = new PocketBase(PB_URL);

// Helper to get file URL
export function getFileUrl(record: any, filename: string) {
    return pb.files.getUrl(record, filename);
}

// Helper to check if user is authenticated (Admin or User)
export function isAuthenticated() {
    return pb.authStore.isValid;
}

// Mapy.cz API Key
export const MAPY_CZ_API_KEY = import.meta.env.VITE_MAPY_CZ_API_KEY || '';
