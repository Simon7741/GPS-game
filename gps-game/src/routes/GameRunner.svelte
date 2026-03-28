<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { pb, getFileUrl } from '../lib/pb';
  import type { Point, Game } from '../lib/types';
  import Map from '../lib/components/Map.svelte';
  import ContentRenderer from '../lib/components/ContentRenderer.svelte';
  import { fade } from 'svelte/transition';

  interface Props {
    gameId: string;
    onExit: () => void;
  }
  let { gameId, onExit }: Props = $props();

  let points: Point[] = $state([]);
  let game: Game | null = $state(null);
  let currentPointIndex = $state(0);
  let loading = $state(true);
  let errorMsg = $state('');
  
  // GPS State
  let currentPos = $state({ lat: 0, lon: 0 });
  let distance = $state(0); 
  let watchId: number | null = null;
  let intervalId: number | null = null;
  let hasGPS = $state(false);

  // UI State
  let navUnlocked = $state(false); 
  let showingRewardContent = $state(false);
  let userPrefersText = $state(false);
  
  let userCode = $state('');
  let codeError = $state('');

  // Computed
  let currentTarget = $derived(points[currentPointIndex]);
  let lastReachedPoint = $derived(currentPointIndex > 0 ? points[currentPointIndex - 1] : null);
  let isFinished = $derived(points.length > 0 && currentPointIndex >= points.length);
  
  // Unified check: Can we show ANY navigation tool (Map or Distance circle)?
  // Rules: Start always has it, others only if they have an Unlock Code
  let canShowNavTools = $derived(
      navUnlocked && (
          currentPointIndex === 0 || !!currentTarget?.code
      )
  );

  // Final visibility of the Map component
  let showMap = $derived(
      canShowNavTools && 
      !userPrefersText && 
      (game?.navigationType === 'map' || currentPointIndex === 0)
  );

  // Check if current target has any info worth toggling to
  let hasTargetInfo = $derived(!!currentTarget?.content?.trim() || !!currentTarget?.image || !!currentTarget?.hint?.trim());

  function saveProgress() {
    localStorage.setItem(`gps_game_progress_${gameId}`, JSON.stringify({
      currentPointIndex
    }));
  }

  // Handle point changes
  $effect(() => {
    if (currentTarget) {
        userCode = '';
        codeError = '';
        showingRewardContent = false;
        userPrefersText = false; 
        navUnlocked = (currentPointIndex === 0 || !currentTarget.code);
    }

    if (points.length > 0) {
      saveProgress();
    }
  });

  onMount(async () => {
    try {
      game = await pb.collection('games').getOne<Game>(gameId);
      points = await pb.collection('points').getFullList<Point>({
        filter: `game = "${gameId}"`,
        sort: 'order'
      });
      
      if (points.length === 0) {
        errorMsg = "This game has no points yet!";
      } else {
        const saved = localStorage.getItem(`gps_game_progress_${gameId}`);
        if (saved) {
          try {
            const data = JSON.parse(saved);
            if (typeof data.currentPointIndex === 'number' && data.currentPointIndex < points.length) {
              currentPointIndex = data.currentPointIndex;
            }
          } catch (e) { console.error("Failed to load progress", e); }
        }
        startTracking();
        
        intervalId = window.setInterval(() => {
            if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(updatePosition, (e) => console.warn("Periodic GPS fail:", e.message));
            }
        }, 60000);
      }
    } catch (e: any) {
      errorMsg = "Failed to load game data: " + e.message;
    } finally {
      loading = false;
    }
  });

  onDestroy(() => {
    if (watchId !== null) navigator.geolocation.clearWatch(watchId);
    if (intervalId !== null) clearInterval(intervalId);
  });

  function getDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
    const R = 6371000;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
  }

  function startTracking() {
    if (!navigator.geolocation) {
      errorMsg = "Geolocation is not supported.";
      return;
    }
    navigator.geolocation.getCurrentPosition(updatePosition, (e) => errorMsg = e.message);
    watchId = navigator.geolocation.watchPosition(
      updatePosition, 
      (e) => errorMsg = e.message,
      { enableHighAccuracy: true }
    );
  }

  function updatePosition(pos: GeolocationPosition) {
    hasGPS = true;
    currentPos.lat = pos.coords.latitude;
    currentPos.lon = pos.coords.longitude;
    
    if (currentTarget && !isFinished) {
      distance = getDistance(currentPos.lat, currentPos.lon, currentTarget.latitude, currentTarget.longitude);
      if (distance <= (currentTarget.radius || 20)) {
        if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
        currentPointIndex++;
      }
    }
  }

  function handleUnlock() {
    if (!currentTarget.code) return;
    if (userCode.trim().toLowerCase() === currentTarget.code.trim().toLowerCase()) {
        navUnlocked = true;
        codeError = '';
        if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
    } else {
        codeError = 'Incorrect code. Try again.';
        userCode = '';
    }
  }

  function skipPoint() { currentPointIndex++; }
  
  function restartGame() {
      if (confirm("Opravdu chcete restartovat celou hru? Veškerý postup bude ztracen.")) {
          currentPointIndex = 0;
          saveProgress();
          window.location.reload();
      }
  }
</script>

<div class="runner-container">
  {#if loading}
    <p>Loading Mission...</p>
  {:else if errorMsg}
    <div class="error-screen">
      <p>{errorMsg}</p>
      <button onclick={onExit}>Exit Game</button>
    </div>
  {:else if isFinished}
    <div class="success-screen" in:fade>
      <h1>Mission Accomplished!</h1>
      <p>You have visited all locations.</p>
      <div class="trophy">🏆</div>
      <button onclick={onExit}>Return to Base</button>
      <button class="debug-btn" onclick={restartGame} style="margin-top: 2rem; border-color: #666;">Restart Game (Debug)</button>
    </div>
  {:else}
    <!-- FIXED TOP BAR -->
    <div class="top-bar">
      <div class="top-bar-content">
          <button class="icon-btn" onclick={onExit} title="Exit Game">&larr;</button>
          <div class="title-wrapper">
              <span class="checkpoint-title">
                  {game?.name || 'Trasa'} | {currentPointIndex === 0 ? 'Start' : `Cíl č. ${currentPointIndex}`}
              </span>
              {#if currentTarget?.name && currentTarget.name !== `Point ${currentPointIndex + 1}`}
                  <span class="point-name-sub">{currentTarget.name}</span>
              {/if}
          </div>
          <div class="header-actions">
              {#if navUnlocked && currentPointIndex > 0 && canShowNavTools && hasTargetInfo}
                  <button class="toggle-view-btn" onclick={() => userPrefersText = !userPrefersText}>
                      {userPrefersText ? (game?.navigationType === 'map' ? '🗺️ Mapa' : '📏 Metry') : '📝 Info'}
                  </button>
              {:else}
                  <div style="width: 44px;"></div>
              {/if}
          </div>
      </div>
    </div>

    <div class="hud">
      {#if !navUnlocked}
        <!-- LOCK SCREEN: Show previous welcome + next clue input -->
        <div class="lock-view">
            {#if lastReachedPoint}
                <div class="combined-info-panel">
                    <div class="clue-header">✅ STATION REACHED</div>
                    <div class="reward-intro"><ContentRenderer text={lastReachedPoint.name} /></div>
                    
                    {#if lastReachedPoint.clue?.trim()}
                        <div class="welcome-text">
                            <ContentRenderer text={lastReachedPoint.clue} />
                        </div>
                    {/if}

                    {#if currentTarget.content?.trim() || currentTarget.image}
                        <div class="nav-info-inline">
                            <div class="clue-header-mini">ℹ️ NAVIGATION INFO</div>
                            <ContentRenderer 
                                text={currentTarget.content} 
                                image={currentTarget.image ? getFileUrl(currentTarget, currentTarget.image) : undefined} 
                            />
                        </div>
                    {/if}
                </div>
            {:else if currentTarget.content?.trim() || currentTarget.image}
                <div class="combined-info-panel">
                    <div class="nav-info-inline" style="margin-top: 0; padding-top: 0; border-top: none;">
                        <div class="clue-header-mini">ℹ️ NAVIGATION INFO</div>
                        <ContentRenderer 
                            text={currentTarget.content} 
                            image={currentTarget.image ? getFileUrl(currentTarget, currentTarget.image) : undefined} 
                        />
                    </div>
                </div>
            {/if}

            <div class="unlock-section">
                {#if currentTarget.hint?.trim()}
                    <div class="clue-container">
                        <div class="clue-header">💡 NEXT HINT / CLUE</div>
                        <p class="point-hint-text">{currentTarget.hint}</p>
                    </div>
                {/if}

                {#if currentTarget.code}
                    <div class="input-container">
                        <p class="input-instruction">Solve the clue to unlock navigation:</p>
                        <div class="input-row">
                            <input type="text" bind:value={userCode} placeholder="Enter code..." onkeydown={(e) => e.key === 'Enter' && handleUnlock()} />
                            <button class="submit-btn" onclick={handleUnlock}>Unlock</button>
                        </div>
                        {#if codeError}<p class="error-msg">{codeError}</p>{/if}
                    </div>
                {/if}
                
                {#if !hasGPS} <p class="warning">📡 Waiting for GPS signal...</p> {/if}
                <div class="debug-actions">
                    <button class="debug-btn" onclick={skipPoint}>Skip Point</button>
                    <button class="debug-btn" onclick={restartGame}>Restart Game</button>
                </div>
            </div>
        </div>
      {:else}
        <!-- NAVIGATION VIEW -->
        <div class="navigation-content">
          {#if showMap}
               <div class="map-view">
                   <Map 
                      points={[currentTarget]} 
                      userPosition={currentPos}
                      center={{ lat: currentTarget.latitude, lon: currentTarget.longitude }}
                   />
                   
                   {#if currentPointIndex > 0 && hasTargetInfo}
                       <button class="floating-toggle-btn" onclick={() => userPrefersText = true}>
                           📝 Zobrazit Info
                       </button>
                   {/if}
               </div>
          {:else}
              <div class="navigation-view-reward">
                  <div class="combined-info-panel inline">
                      {#if lastReachedPoint}
                          <div class="clue-header">✅ STATION REACHED</div>
                          <div class="reward-intro"><ContentRenderer text={lastReachedPoint.name} /></div>
                          {#if lastReachedPoint.clue?.trim()}
                              <div class="welcome-text">
                                  <ContentRenderer text={lastReachedPoint.clue} />
                              </div>
                          {/if}
                      {/if}

                      {#if currentTarget.content?.trim() || currentTarget.image}
                          <div class="nav-info-inline">
                              <div class="clue-header-mini">ℹ️ NAVIGATION INFO</div>
                              <ContentRenderer 
                                  text={currentTarget.content} 
                                  image={currentTarget.image ? getFileUrl(currentTarget, currentTarget.image) : undefined} 
                              />
                          </div>
                      {/if}
                  </div>

                  {#if currentTarget.hint?.trim()}
                      <div class="next-hint-container">
                          <div class="clue-header">💡 NEXT HINT</div>
                          <p class="point-hint-text">{currentTarget.hint}</p>
                      </div>
                  {/if}

                  {#if game?.navigationType === 'distance' && canShowNavTools}
                      <div class="distance-navigation-box">
                          <div class="distance-circle">
                              <span class="value">{distance.toFixed(0)}</span>
                              <span class="unit">meters</span>
                          </div>
                          <p class="instruction">Follow the distance to find the point!</p>
                      </div>
                  {:else if canShowNavTools}
                      <div class="back-to-map-container">
                          <button class="proceed-btn" onclick={() => userPrefersText = false}>
                              🗺️ Zpět na Mapu
                          </button>
                      </div>
                  {/if}

                  <div class="debug-actions">
                      <button class="debug-btn" onclick={skipPoint}>Skip Point</button>
                      <button class="debug-btn" onclick={restartGame}>Restart Game</button>
                  </div>
              </div>
          {/if}
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .runner-container {
    height: 100dvh;
    display: flex;
    flex-direction: column;
    background: #000;
    color: white;
    text-align: center;
    overflow: hidden;
  }

  .top-bar {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    background: #000;
    z-index: 1000;
    border-bottom: 1px solid rgba(255,255,255,0.1);
    padding-top: env(safe-area-inset-top, 25px);
  }

  .top-bar-content {
    min-height: 70px;
    padding: 0.5rem 1rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 0.5rem;
  }

  .title-wrapper {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      overflow: hidden;
      padding: 0 4px;
  }

  .checkpoint-title {
      font-weight: bold;
      color: #ff3e00;
      font-size: 1rem;
      line-height: 1.2;
      text-align: center;
  }

  .point-name-sub {
      font-size: 0.7rem;
      color: #aaa;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 100%;
      margin-top: 2px;
  }

  .header-actions {
      display: flex;
      justify-content: flex-end;
      min-width: 44px;
  }

  .toggle-view-btn {
      background: #ff3e00;
      color: white;
      padding: 0.4rem 0.8rem;
      font-size: 0.8rem;
      border-radius: 6px;
      white-space: nowrap;
      font-weight: bold;
      border: none;
  }

  .floating-toggle-btn {
      position: absolute;
      bottom: 2rem;
      left: 50%;
      transform: translateX(-50%);
      z-index: 1000;
      background: rgba(0, 0, 0, 0.85);
      color: white;
      padding: 0.8rem 1.5rem;
      border-radius: 30px;
      border: 2px solid #ff3e00;
      font-weight: bold;
      box-shadow: 0 4px 15px rgba(0,0,0,0.5);
  }

  .hud {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    position: relative;
    margin-top: calc(85px + env(safe-area-inset-top, 25px));
  }

  .lock-view {
      flex: 1;
      display: flex;
      flex-direction: column;
      overflow-y: auto;
      background: #1a1a1a;
  }

  .combined-info-panel {
      background: #f0f0f0;
      color: #333;
      padding: 1.5rem 1rem;
      text-align: left;
      border-bottom: 2px solid #ddd;
  }

  .combined-info-panel.inline {
      border-bottom: none;
      margin-bottom: 0;
  }

  .reward-intro {
      margin-bottom: 0.5rem;
      padding-bottom: 0.5rem;
      border-bottom: 1px solid #ddd;
  }
  .reward-intro :global(.clue-text) {
      font-size: 1.1rem;
      font-weight: bold;
      color: #ff3e00;
      padding: 0;
      background: transparent;
  }

  .welcome-text {
      margin-bottom: 1rem;
  }

  .nav-info-inline {
      margin-top: 1rem;
      padding-top: 1rem;
      border-top: 2px dashed #ccc;
  }

  .clue-header-mini {
      font-size: 0.65rem;
      color: #888;
      letter-spacing: 1px;
      font-weight: bold;
      margin-bottom: 0.5rem;
      text-transform: uppercase;
  }

  .combined-info-panel :global(.clue-text) {
      font-size: 1rem;
      padding: 0;
      background: transparent;
  }
  
  .unlock-section {
      padding: 1.5rem 1rem;
      display: flex;
      flex-direction: column;
      align-items: center;
  }

  .navigation-content {
      flex: 1;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      height: 100%;
  }
  
  .map-view {
      width: 100%;
      height: 100%;
      flex: 1;
      position: relative;
      min-height: 300px;
  }

  .navigation-view-reward {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow-y: auto;
    padding: 0;
    background: #1a1a1a;
  }

  .distance-navigation-box {
      padding: 2rem 1rem;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
  }

  .distance-circle {
    width: 140px;
    height: 140px;
    border-radius: 50%;
    border: 6px solid #ff3e00;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    margin-bottom: 1.5rem;
    background: rgba(255, 62, 0, 0.1);
    box-shadow: 0 0 30px rgba(255, 62, 0, 0.2);
  }

  .value { font-size: 3rem; font-weight: bold; }
  .unit { font-size: 0.9rem; opacity: 0.7; text-transform: uppercase; }

  .next-hint-container {
      padding: 1rem;
      background: rgba(255,255,255,0.05);
      border-radius: 12px;
      width: 90%;
      margin: 1rem auto 1.5rem auto;
      border: 1px solid #333;
      text-align: left;
  }

  .back-to-map-container {
      padding: 1rem;
      width: 90%;
      margin: 0 auto;
  }

  .proceed-btn {
      width: 100%;
      background: #2196F3;
      color: white;
      border-radius: 8px;
  }

  .clue-container {
    background: white;
    color: #333;
    padding: 1.5rem;
    border-radius: 12px;
    width: 90%;
    max-width: 500px;
    margin-bottom: 1.5rem;
    box-shadow: 0 4px 15px rgba(0,0,0,0.3);
  }

  .point-hint-text {
      font-size: 1.1rem;
      margin: 0.5rem 0;
      color: #333;
      line-height: 1.4;
      font-style: italic;
  }
  
  button {
    padding: 0.8rem 1.5rem;
    border: none;
    border-radius: 8px;
    font-weight: bold;
    cursor: pointer;
    font-size: 1rem;
  }

  .icon-btn {
      background: rgba(255,255,255,0.1);
      color: white;
      width: 44px;
      height: 44px;
      padding: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.4rem;
      border-radius: 50%;
  }

  .clue-header {
      font-size: 0.7rem;
      color: #999;
      letter-spacing: 1px;
      font-weight: bold;
      margin-bottom: 0.5rem;
      text-transform: uppercase;
  }

  .input-container {
      width: 90%;
      max-width: 500px;
      background: rgba(255,255,255,0.05);
      padding: 1.2rem;
      border-radius: 12px;
      border: 1px solid #444;
  }
  .input-instruction {
      font-size: 0.85rem;
      color: #aaa;
      margin-bottom: 0.8rem;
  }
  .input-row {
      display: flex;
      gap: 0.5rem;
  }
  .input-row input {
      flex: 1;
      padding: 0.7rem;
      border-radius: 8px;
      border: 1px solid #666;
      background: #222;
      color: white;
  }
  .submit-btn {
      background: #2196F3;
      color: white;
  }
  .error-msg {
      color: #ff4444;
      font-size: 0.8rem;
      margin-top: 0.5rem;
  }
  .warning { color: #ff9800; margin-top: 1.5rem; font-size: 0.9rem; }
  
  .debug-actions {
      display: flex;
      gap: 0.5rem;
      margin-top: 1.5rem;
      flex-wrap: wrap;
      justify-content: center;
  }

  .debug-btn {
    background: transparent;
    border: 1px solid #333;
    color: #444;
    font-size: 0.7rem;
    padding: 0.4rem 0.8rem;
  }
</style>
