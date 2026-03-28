<script lang="ts">
  import { onMount } from 'svelte';
  import { pb } from '../lib/pb';
  import type { Game } from '../lib/types';
  import { fade } from 'svelte/transition';

  let games: Game[] = $state([]);
  let loading = $state(true);
  let error = $state('');

  interface Props {
    onSelectGame: (gameId: string) => void;
  }
  let { onSelectGame }: Props = $props();

  onMount(async () => {
    try {
      games = await pb.collection('games').getFullList<Game>({
        filter: 'active = true',
        sort: '-created'
      });
    } catch (e: any) {
      error = "Failed to load games. Is the server running?";
    } finally {
      loading = false;
    }
  });

  function formatDistance(meters: number) {
      if (!meters) return '';
      if (meters > 1000) return (meters / 1000).toFixed(2) + ' km';
      return Math.round(meters) + ' m';
  }
</script>

<div class="home-container">
  <h1>Choose Your Adventure</h1>
  
  {#if loading}
    <p>Loading games...</p>
  {:else if error}
    <p class="error">{error}</p>
  {:else if games.length === 0}
    <p>No active games found. Ask an admin to create one!</p>
  {:else}
    <div class="game-grid" in:fade>
      {#each games as game}
        <button class="game-card" onclick={() => onSelectGame(game.id)}>
          <div class="card-content">
            <h2>{game.name}</h2>
            <p>{game.description}</p>
            {#if game.totalDistance}
                <div class="stat-row">
                    <span class="dist-stat">📏 Path length: {formatDistance(game.totalDistance)}</span>
                </div>
            {/if}
          </div>
          <span class="start-btn">Start Quest &rarr;</span>
        </button>
      {/each}
    </div>
  {/if}
</div>

<style>
  .home-container {
    max-width: 800px;
    margin: 0 auto;
    padding: 2rem;
    text-align: center;
    color: white;
  }

  h1 {
    font-size: 2.5rem;
    margin-bottom: 2rem;
    color: #ff3e00;
  }

  .game-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 1.5rem;
  }

  .game-card {
    background: #2a2a2a;
    border: 1px solid #444;
    border-radius: 12px;
    padding: 1.5rem;
    color: #eee;
    text-align: left;
    cursor: pointer;
    transition: transform 0.2s, box-shadow 0.2s;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    height: 100%;
  }

  .card-content {
      flex: 1;
      display: flex;
      flex-direction: column;
  }

  .game-card:hover {
    transform: translateY(-5px);
    box-shadow: 0 10px 20px rgba(0,0,0,0.3);
    border-color: #ff3e00;
  }

  .game-card h2 {
    margin: 0 0 0.5rem 0;
    color: #4CAF50;
  }

  .game-card p {
    color: #ccc;
    font-size: 0.9rem;
    margin-bottom: 1rem;
    flex: 1;
  }

  .stat-row {
      margin-bottom: 1.5rem;
      font-size: 0.85rem;
      color: #888;
  }

  .dist-stat {
      background: rgba(76, 175, 80, 0.1);
      color: #4CAF50;
      padding: 0.2rem 0.5rem;
      border-radius: 4px;
      font-weight: bold;
  }

  .start-btn {
    align-self: flex-end;
    color: #ff3e00;
    font-weight: bold;
    font-size: 0.9rem;
  }

  .error {
    color: #ff4444;
    background: rgba(255, 68, 68, 0.1);
    padding: 1rem;
    border-radius: 8px;
  }
</style>
