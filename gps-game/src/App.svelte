<script lang="ts">
  import { onMount } from 'svelte';
  import { pb, isAuthenticated } from './lib/pb';
  import Admin from './routes/Admin.svelte';
  import Home from './routes/Home.svelte';
  import GameRunner from './routes/GameRunner.svelte';
  import { fade } from 'svelte/transition';

  let view = $state('home');
  let gameId = $state('');

  function handleHashChange() {
    const hash = window.location.hash.slice(1);
    if (hash === 'admin') {
      view = 'admin';
    } else if (hash.startsWith('game=')) {
      view = 'game';
      gameId = hash.split('=')[1];
    } else {
      view = 'home';
    }
  }

  onMount(() => {
    window.addEventListener('hashchange', handleHashChange);
    handleHashChange();
    return () => {
      window.removeEventListener('hashchange', handleHashChange);
    };
  });

  function navigate(path: string) {
    window.location.hash = path;
  }
</script>

<main>
  {#if view === 'admin'}
    <Admin />
  {:else if view === 'game'}
    <GameRunner {gameId} onExit={() => navigate('')} />
  {:else}
    <Home onSelectGame={(id) => navigate(`game=${id}`)} />
    
    <!-- Secret Admin Link (bottom right corner) -->
    <a href="#admin" class="admin-link">Create Track / Admin</a>
  {/if}
</main>

<style>
  :global(html, body) {
    background-color: #1a1a1a;
    color: #f0f0f0;
    font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
    margin: 0;
    padding: 0;
    overflow: hidden;
    height: 100dvh;
    width: 100vw;
  }

  main {
    height: 100%;
    width: 100%;
    position: relative;
  }

  .admin-link {
    position: fixed;
    bottom: 10px;
    right: 10px;
    color: #666;
    text-decoration: none;
    font-size: 0.8rem;
    background: rgba(255,255,255,0.05);
    padding: 0.4rem 0.8rem;
    border-radius: 4px;
    transition: all 0.2s;
  }
  .admin-link:hover { background: rgba(255,255,255,0.1); color: #fff; }
</style>
