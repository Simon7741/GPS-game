export interface Game {
    id: string;
    name: string;
    description: string;
    active: boolean;
    navigationType?: 'map' | 'distance'; // Global setting for the game
    totalDistance?: number; // Total distance in meters
    owner?: string | string[]; // Relation to the users collection
    created: string;
    updated: string;
}

export interface Point {
    id: string;
    game: string; // Relation to Game ID
    order: number;
    latitude: number;
    longitude: number;
    radius: number;
    type: 'text' | 'image' | 'text_map';
    name?: string;
    content?: string; // For text/latex
    image?: string; // Filename from PocketBase
    code?: string; // Optional passcode/answer to complete the point
    hint?: string; // Hint shown before arrival
    clue?: string; // Additional text shown before content in reward box
    hideDistance?: boolean; // If true, distance hint is never shown
}
