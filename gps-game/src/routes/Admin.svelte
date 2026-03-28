<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { pb, isAuthenticated, MAPY_CZ_API_KEY } from '../lib/pb';
  import Map from '../lib/components/Map.svelte';
  import type { Game, Point } from '../lib/types';
  import { fade } from 'svelte/transition';

  let email = $state('');
  let password = $state('');
  let passwordConfirm = $state('');
  let isRegistering = $state(false);
  let isLoggedIn = $state(isAuthenticated());
  let loading = $state(false);
  let error = $state('');

  let games: Game[] = $state([]);
  let editingGame: Game | null = $state(null);
  let gamePoints: Point[] = $state([]);
  
  let gameName = $state('');
  let gameDesc = $state('');
  let gameNavType: 'map' | 'distance' = $state('distance');
  let isEditingTrackInfo = $state(false);
  let tempTrackName = $state('');
  let tempTrackDesc = $state('');

  let selectedPoint: Point | null = $state(null);
  let pointNameInput = $state(''); 
  let pointHint = $state('');
  let pointClue = $state('');
  let pointContent = $state('');
  let pointCode = $state('');
  let pointHideDistance = $state(false);
  let pointType: 'text' | 'image' | 'text_map' = $state('text');
  let pointFile: FileList | null = $state(null);

  let distances: string[] = $state([]);
  let routeGeometry: any[] = $state([]); 
  let routeType: 'direct' | 'car' | 'bike' | 'foot' = $state('foot'); 
  let calculatingDistances = $state(false);

  let showUsers = $state(false);
  let usersList: any[] = $state([]);
  let isSuperUser = $state(false); 
  let isVerified = $state(false);

  const MAPY_ROUTE_TYPES = {
      car: 'car_fast',
      bike: 'bike_road',
      foot: 'foot_fast'
  };

  const unsubscribe = pb.authStore.onChange(() => {
    isLoggedIn = pb.authStore.isValid;
    updateAuthInfo();
  });
  
  function updateAuthInfo() {
      const model = pb.authStore.model;
      if (!model) {
          isSuperUser = false;
          isVerified = false;
          return;
      }
      
      // Superuser check: PB 0.23+ uses collectionName/Id = '_superusers'
      // Old PB used model.isAdmin
      isSuperUser = (model as any).collectionName === '_superusers' || 
                    (model as any).collectionId === '_superusers' ||
                    (model as any).isAdmin === true;
      
      isVerified = isSuperUser || (model as any).verified === true;
      console.log("Auth Status:", { email: model.email, isSuperUser, isVerified });
  }

  onMount(async () => {
    updateAuthInfo();
    if (isLoggedIn) {
      await loadGames();
      if (isSuperUser) await loadUsers();
    }
  });

  onDestroy(() => {
      unsubscribe();
  });

  async function login() {
    loading = true;
    error = '';
    try {
      if (isRegistering) {
          if (!email || !password) throw new Error("Email and password required");
          if (password !== passwordConfirm) throw new Error("Passwords do not match");
          
          await pb.collection('users').create({
              email,
              password,
              passwordConfirm,
              verified: false
          });
          await pb.collection('users').authWithPassword(email, password);
      } else {
          try {
            await pb.collection('users').authWithPassword(email, password);
          } catch (e) {
            try {
                await pb.collection('_superusers').authWithPassword(email, password);
            } catch (e2) {
                throw new Error("Invalid email or password");
            }
          }
      }
      isLoggedIn = pb.authStore.isValid;
      updateAuthInfo();
      await loadGames();
      if (isSuperUser) loadUsers();
    } catch (e: any) {
      error = (isRegistering ? "Registration failed: " : "Login failed: ") + e.message;
    } finally { loading = false; }
  }

  function logout() {
    pb.authStore.clear();
    isLoggedIn = false;
    isSuperUser = false;
    isVerified = false;
    games = [];
    editingGame = null;
    showUsers = false;
  }

  async function loadUsers() {
      if (!isSuperUser) return;
      try {
          usersList = await pb.collection('users').getFullList({ sort: '-created' });
      } catch (e: any) { 
          console.error("Failed to load users:", e);
          error = "User Management Error: " + e.message;
      }
  }

  async function toggleVerified(user: any) {
      if (!confirm(`Toggle verification for ${user.email}?`)) return;
      try {
          await pb.collection('users').update(user.id, { verified: !user.verified });
          await loadUsers();
      } catch (e: any) { error = "Failed to update user: " + e.message; }
  }

  async function loadGames() {
    try {
      if (isSuperUser) {
          games = await pb.collection('games').getFullList<Game>({ sort: '-created' });
      } else {
          try {
              // Try to filter by owner (new system)
              // We use ~ for multi-relation "contains" check in PB 0.23+
              games = await pb.collection('games').getFullList<Game>({
                  filter: `owner ~ "${pb.authStore.model?.id}"`,
                  sort: '-created'
              });
              
              // Fallback: If no games found for this owner, and they are verified,
              // they might be looking for games created before the owner field was added.
              // We'll also show games with NO owner as they are currently "orphaned".
              if (games.length === 0 && isVerified) {
                  const allGames = await pb.collection('games').getFullList<Game>({ sort: '-created' });
                  // Only show ownerless games if they are verified
                  games = allGames.filter(g => !g.owner || (Array.isArray(g.owner) && g.owner.length === 0));
                  if (games.length > 0) {
                      console.log(`Found ${games.length} ownerless games as fallback.`);
                  }
              }
          } catch (e: any) {
              // Fallback: If owner field doesn't exist yet, show all (or none if rules apply)
              console.warn("Filtering by owner failed, showing all games as fallback:", e.message);
              games = await pb.collection('games').getFullList<Game>({ sort: '-created' });
          }
      }
    } catch (e: any) { 
        console.error("Failed to load games:", e);
        error = "Load Games Error: " + e.message; 
    }
  }

  async function createGame() {
    if (!isVerified) { error = "Your account is pending approval."; return; }
    if (!gameName) return;
    try {
      // In PB 0.23+, superusers (admins) are in a different collection.
      // The 'owner' field relates to the 'users' collection.
      // If we are a superuser, we don't have a record in the 'users' collection,
      // so we should not set ourselves as owner (the relation would be invalid).
      const ownerId = isSuperUser ? null : pb.authStore.model?.id;
      
      const record = await pb.collection('games').create({
        name: gameName,
        description: gameDesc,
        navigationType: gameNavType,
        active: true,
        owner: ownerId
      });
      games = [record, ...games];
      gameName = '';
      gameDesc = '';
      editGame(record); 
    } catch (e: any) { error = "Create failed: " + e.message; }
  }

  let successMsg = $state('');

  async function updateGameSettings() {
    if (!editingGame) return;
    try {
        const record = await pb.collection('games').update(editingGame.id, {
            name: editingGame.name,
            description: editingGame.description,
            navigationType: editingGame.navigationType,
            totalDistance: editingGame.totalDistance
        });
        // Snapshot the record into the reactive state to ensure Svelte 5 tracks it correctly
        editingGame = { ...record };
        games = games.map(g => g.id === record.id ? record : g);
        successMsg = 'Updated!';
        setTimeout(() => successMsg = '', 1500);
    } catch (e: any) { error = "Failed to update game settings: " + e.message; }
  }

  function startEditingTrackInfo() {
      if (!editingGame) return;
      tempTrackName = editingGame.name;
      tempTrackDesc = editingGame.description;
      isEditingTrackInfo = true;
  }

  async function saveTrackInfo() {
      if (!editingGame) return;
      editingGame.name = tempTrackName;
      editingGame.description = tempTrackDesc;
      await updateGameSettings();
      isEditingTrackInfo = false;
  }

  async function deleteGame(id: string) {
    if (!confirm('Delete this game?')) return;
    try {
      await pb.collection('games').delete(id);
      games = games.filter(g => g.id !== id);
      if (editingGame?.id === id) editingGame = null;
    } catch (e: any) { error = "Delete failed: " + e.message; }
  }

  async function editGame(game: Game) {
    editingGame = game;
    isEditingTrackInfo = false;
    error = '';
    try {
      gamePoints = await pb.collection('points').getFullList<Point>({
        filter: `game = "${game.id}"`,
        sort: 'order'
      });
      calculateDistances();
    } catch (e: any) { error = "Failed to load points: " + e.message; }
  }

  function closeEditor() {
    editingGame = null;
    isEditingTrackInfo = false;
    gamePoints = [];
    selectedPoint = null;
    distances = [];
    routeGeometry = [];
  }

  async function addPoint(lat: number, lng: number) {
    if (!editingGame) return;
    const tempId = 'temp_' + Date.now();
    const newPoint: any = {
      game: editingGame.id,
      order: gamePoints.length,
      latitude: lat,
      longitude: lng,
      radius: 20,
      type: 'text',
      name: `Point ${gamePoints.length + 1}`,
      content: 'New Point'
    };
    gamePoints = [...gamePoints, { ...newPoint, id: tempId }];
    try {
      const { id, ...pointData } = newPoint;
      const record = await pb.collection('points').create(pointData);
      gamePoints = gamePoints.map(p => p.id === tempId ? record : p);
      selectPoint(record);
      calculateDistances();
    } catch (e: any) {
      error = "Failed to create point: " + e.message;
      gamePoints = gamePoints.filter(p => p.id !== tempId);
    }
  }

  function selectPoint(point: Point) {
    selectedPoint = point;
    pointNameInput = point.name || `Point ${gamePoints.indexOf(point) + 1}`;
    pointHint = point.hint || '';
    pointClue = point.clue || '';
    pointContent = point.content || '';
    pointCode = point.code || '';
    pointHideDistance = !!point.hideDistance;
    pointType = point.type;
    pointFile = null;
  }

  async function savePoint() {
    if (!selectedPoint) return;
    try {
      const formData = new FormData();
      formData.append('name', pointNameInput);
      formData.append('hint', pointHint);
      formData.append('clue', pointClue);
      formData.append('type', pointType);
      formData.append('content', pointContent);
      formData.append('code', pointCode);
      formData.append('hideDistance', String(pointHideDistance));
      
      if (pointType === 'image' && pointFile && pointFile[0]) {
          formData.append('image', pointFile[0]);
      }
      
      const record = await pb.collection('points').update(selectedPoint.id, formData);
      gamePoints = gamePoints.map(p => p.id === selectedPoint!.id ? record : p);
      selectedPoint = null; 
    } catch (e: any) { error = "Save failed: " + e.message; }
  }

  async function deletePoint(id: string) {
    if (!confirm('Delete this point?')) return;
    try {
      await pb.collection('points').delete(id);
      gamePoints = gamePoints.filter(p => p.id !== id);
      selectedPoint = null;
      calculateDistances();
    } catch (e: any) { error = "Delete failed: " + e.message; }
  }

  async function updatePointPosition(point: Point, lat: number, lng: number) {
    gamePoints = gamePoints.map(p => p.id === point.id ? { ...p, latitude: lat, longitude: lng } : p);
    calculateDistances();
    try {
      await pb.collection('points').update(point.id, { latitude: lat, longitude: lng });
    } catch (e: any) { error = "Failed to update position: " + e.message; }
  }

  // --- Drag and Drop ---
  let draggedItemIndex: number | null = null;
  function handleDragStart(e: DragEvent, index: number) { draggedItemIndex = index; if (e.dataTransfer) { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.dropEffect = 'move'; } }
  function handleDragOver(e: DragEvent, index: number) { e.preventDefault(); if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'; }
  async function handleDrop(e: DragEvent, dropIndex: number) {
    e.preventDefault();
    if (draggedItemIndex === null || draggedItemIndex === dropIndex) return;
    const newPoints = [...gamePoints];
    const [draggedItem] = newPoints.splice(draggedItemIndex, 1);
    newPoints.splice(dropIndex, 0, draggedItem);
    newPoints.forEach((p, i) => p.order = i);
    gamePoints = newPoints;
    draggedItemIndex = null;
    calculateDistances();
    try { await Promise.all(gamePoints.map(p => pb.collection('points').update(p.id, { order: p.order }))); } catch (e: any) { error = "Failed to reorder points: " + e.message; }
  }

  // --- Distances ---
  async function calculateDistances() {
      routeGeometry = []; 
      if (gamePoints.length < 2) { 
          distances = []; 
          if (editingGame && editingGame.totalDistance !== 0) {
              editingGame.totalDistance = 0;
              updateGameSettings();
          }
          return; 
      }
      calculatingDistances = true;
      distances = new Array(gamePoints.length - 1).fill('...');
      const newGeometry: any[] = [];
      let totalMeters = 0;

      for (let i = 0; i < gamePoints.length - 1; i++) {
          const p1 = gamePoints[i];
          const p2 = gamePoints[i+1];
          if (routeType === 'direct') {
              const d = getHaversineDistance(p1.latitude, p1.longitude, p2.latitude, p2.longitude);
              distances[i] = formatDistance(d);
              totalMeters += d;
          } else {
              if (!MAPY_CZ_API_KEY) { distances[i] = 'Key Missing'; continue; }
              try {
                  const mType = MAPY_ROUTE_TYPES[routeType as keyof typeof MAPY_ROUTE_TYPES];
                  const url = `https://api.mapy.cz/v1/routing/route?apikey=${MAPY_CZ_API_KEY}&start=${p1.longitude},${p1.latitude}&end=${p2.longitude},${p2.latitude}&routeType=${mType}&geometry=true`;
                  const res = await fetch(url);
                  if (!res.ok) { distances[i] = 'Err ' + res.status; continue; }
                  const data = await res.json();
                  if (data.length) {
                      distances[i] = formatDistance(data.length);
                      totalMeters += data.length;
                  }
                  else distances[i] = 'No route';
                  const geo = data.geometry?.geometry || data.geometry;
                  if (geo && geo.coordinates) { newGeometry.push(geo.coordinates.map((c: number[]) => [c[1], c[0]])); }
              } catch (e) { distances[i] = 'Error'; }
          }
      }
      routeGeometry = newGeometry;
      calculatingDistances = false;

      // Save total distance to game
      if (editingGame && editingGame.totalDistance !== totalMeters) {
          editingGame.totalDistance = totalMeters;
          updateGameSettings();
      }
  }

  function getHaversineDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
    const R = 6371000;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
  }

  function formatDistance(meters: number) {
      if (meters > 1000) return (meters / 1000).toFixed(2) + ' km';
      return Math.round(meters) + ' m';
  }
</script>

<div class="admin-container">
  {#if !isLoggedIn}
    <div class="login-box" in:fade>
      <h2>{isRegistering ? 'Creator Registration' : 'Creator Login'}</h2>
      <p class="login-info">Only path creators need to log in.</p>
      <input type="email" bind:value={email} placeholder="Email" />
      <input type="password" bind:value={password} placeholder="Password" onkeydown={(e) => e.key === 'Enter' && login()} />
      {#if isRegistering} <input type="password" bind:value={passwordConfirm} placeholder="Confirm Password" onkeydown={(e) => e.key === 'Enter' && login()} /> {/if}
      <button onclick={login} disabled={loading}>{loading ? 'Processing...' : (isRegistering ? 'Create Account' : 'Login')}</button>
      <p class="toggle-mode">{isRegistering ? 'Already have an account?' : 'Want to create tracks?'} <button class="link-btn" onclick={() => isRegistering = !isRegistering}>{isRegistering ? 'Login here' : 'Register here'}</button></p>
      <a href="#" class="back-home-link">← Back to Home</a>
      {#if error}<p class="error">{error}</p>{/if}
    </div>
  {:else}
    <header>
      <div class="header-left">
          <h1>Track Editor</h1>
          {#if isSuperUser} <span class="badge superuser">SUPERUSER</span>
          {:else if isVerified} <span class="badge verified">VERIFIED CREATOR</span> {/if}
      </div>
      <div class="header-actions">
          {#if isSuperUser} <button class="users-btn" onclick={() => { showUsers = !showUsers; if(showUsers) loadUsers(); }}>{showUsers ? 'View My Games' : 'Manage All Users'}</button> {/if}
          <button class="logout-btn" onclick={logout}>Logout</button>
      </div>
    </header>

    {#if showUsers && isSuperUser}
      <div class="dashboard" in:fade>
          <div class="section-header"><h3>User Management</h3><button class="refresh-btn" onclick={loadUsers}>Refresh List</button></div>
          {#if usersList.length === 0} <p>No users found.</p> {/if}
          <div class="users-grid">
              {#each usersList as user}
                  <div class="user-card">
                      <div class="user-info">
                          <strong>{user.email}</strong>
                          <span class="status {user.verified ? 'verified' : 'pending'}">{user.verified ? '✓ Verified' : '⏳ Pending Approval'}</span>
                          <span class="date">Joined: {new Date(user.created).toLocaleDateString()}</span>
                      </div>
                      <div class="user-actions"><button class="verify-btn" onclick={() => toggleVerified(user)}>{user.verified ? 'Revoke' : 'Approve'}</button></div>
                  </div>
              {/each}
          </div>
      </div>
    {:else if editingGame}
      <div class="editor-layout">
        <div class="sidebar">
          <div class="sidebar-header">
            <button class="back-btn" onclick={closeEditor} title="Back to Games List">&larr;</button>
            <div class="header-text">
                {#if isEditingTrackInfo}
                  <div class="track-info-editor">
                    <input type="text" bind:value={tempTrackName} placeholder="Track Name" class="track-edit-input" />
                    <textarea bind:value={tempTrackDesc} placeholder="Description" class="track-edit-desc" rows="2"></textarea>
                    <div class="track-edit-actions">
                      <button class="save-btn-mini" onclick={saveTrackInfo}>Save</button>
                      <button class="cancel-btn-mini" onclick={() => isEditingTrackInfo = false}>Cancel</button>
                    </div>
                  </div>
                {:else}
                  <h3 onclick={startEditingTrackInfo} title="Click to rename" class="clickable-title">
                    {editingGame?.name || 'Untitled Track'}
                  </h3>
                  <p onclick={startEditingTrackInfo} class="clickable-desc" title="Click to edit description">
                    {editingGame?.description || 'No description'}
                  </p>
                  <select class="nav-select-mini" value={editingGame?.navigationType || 'distance'} onchange={(e) => { 
                      if (editingGame) {
                          editingGame.navigationType = (e.target as HTMLSelectElement).value as any; 
                          updateGameSettings();
                      }
                  }}>
                      <option value="distance">Mode: Distance</option>
                      <option value="map">Mode: Map</option>
                  </select>
                {/if}
            </div>
          </div>
          <div class="points-list">
            <div class="list-header"><h4>Waypoints</h4><div class="route-options"><select bind:value={routeType} onchange={calculateDistances}><option value="direct">Direct</option><option value="foot">Walk</option><option value="bike">Bike</option><option value="car">Car</option></select></div></div>
            <ul>
              {#each gamePoints as point, i (point.id)} 
                <li class:active={selectedPoint?.id === point.id} draggable="true" ondragstart={(e) => handleDragStart(e, i)} ondragover={(e) => handleDragOver(e, i)} ondrop={(e) => handleDrop(e, i)}>
                  <div class="point-row"><span class="drag-handle">☰</span><button class="point-btn" onclick={() => selectPoint(point)}><span class="point-num">{i + 1}</span><span class="point-name-display">{point.name || point.type}</span></button><button class="del-btn" onclick={() => deletePoint(point.id)}>×</button></div>
                  {#if i < gamePoints.length - 1} <div class="distance-info">⬇️ {distances[i] || '...'}</div> {/if}
                </li>
              {/each}
            </ul>
             {#if gamePoints.length === 0} <p class="hint">Click map to add points.</p> {/if}
          </div>
          {#if selectedPoint}
            <div class="point-editor">
              <h4>Edit Point</h4>
              <label>Name: <input type="text" bind:value={pointNameInput} placeholder="Point Label" /></label>
              <label>Hint (Shown before arrival): <textarea bind:value={pointHint} rows="2" placeholder="Help the player find the location..."></textarea></label>
              <label>Welcome Block (Shown after arrival): <textarea bind:value={pointClue} rows="2" placeholder="Welcome the player! (Optional)"></textarea></label>
              
              <div class="inline-fields">
                  <label>Unlock Code (Optional): <input type="text" bind:value={pointCode} placeholder="SECRET123" /></label>
                  <label class="checkbox-label"><input type="checkbox" bind:checked={pointHideDistance} /> Hide dist.</label>
              </div>

              <label>Content Type: 
                  <select bind:value={pointType}>
                      <option value="text">Text Only</option>
                      <option value="image">Image + Text</option>
                      <option value="text_map">Text + Map</option>
                  </select>
              </label>

              <label>Navigation Info / Content (Shown before arrival): <textarea bind:value={pointContent} rows="4" placeholder="Extra info to help find the point..."></textarea></label>
              
              {#if pointType === 'image'}
                  <input type="file" bind:files={pointFile} accept="image/*" />
                  {#if selectedPoint.image} <p class="small">Current image: {selectedPoint.image}</p> {/if}
              {/if}

              <div class="editor-actions"><button class="save-btn" onclick={savePoint}>Save</button><button class="cancel-btn" onclick={() => selectedPoint = null}>Cancel</button></div>
            </div>
          {/if}
        </div>
        <div class="map-wrapper"><Map points={gamePoints} editable={true} routeGeometry={routeGeometry} onMapClick={addPoint} onPointClick={selectPoint} onPointMove={updatePointPosition} /></div>
      </div>
    {:else}
      <div class="dashboard" in:fade>
        {#if !isVerified}<div class="pending-notice"><h3>Account Pending Approval</h3><p>Hello! Your account has been created. A Superuser must verify your account before you can start creating tracks.</p></div>
        {:else}<div class="create-game"><h3>Create New Track</h3><input type="text" bind:value={gameName} placeholder="Track Name" /><input type="text" bind:value={gameDesc} placeholder="Description" /><div class="nav-choice"><label>Navigation Style: <select bind:value={gameNavType}><option value="distance">Distance Hints</option><option value="map">Map Navigation</option></select></label></div><button onclick={createGame} disabled={!gameName}>Create</button></div>{/if}
        <div class="games-list">
          <h3>{isSuperUser ? 'All Tracks (Superuser View)' : 'My Tracks'}</h3>
          {#if games.length === 0} <p>No tracks found.</p> {/if}
          <ul>
            {#each games as game}
              <li>
                <div class="game-info">
                  <div class="game-title-row">
                    <strong>{game.name}</strong>
                    <span class="nav-badge {game.navigationType === 'map' ? 'map' : 'dist'}">
                        {game.navigationType === 'map' ? '🗺️ Map' : '📏 Dist'}
                    </span>
                  </div>
                  <span class="desc">{game.description}</span>
                  {#if game.totalDistance}
                    <span class="total-dist-badge">📏 {formatDistance(game.totalDistance)}</span>
                  {/if}
                </div>
                <div class="actions">
                  <button onclick={() => editGame(game)}>Edit</button>
                  <button class="del-btn" onclick={() => deleteGame(game.id)}>Delete</button>
                </div>
              </li>
            {/each}
          </ul>
        </div>
      </div>
    {/if}
    {#if successMsg} <div class="toast-success">{successMsg}</div> {/if}
    {#if error && isLoggedIn} <div class="toast-error">{error}</div> {/if}
  {/if}
</div>

<style>
  .admin-container { height: 100vh; display: flex; flex-direction: column; font-family: sans-serif; color: #333; background: #f4f4f4; }
  header { background: #333; color: white; padding: 1rem; display: flex; justify-content: space-between; align-items: center; flex-shrink: 0; }
  .header-left { display: flex; align-items: center; gap: 1rem; }
  .header-actions { display: flex; gap: 1rem; align-items: center; }
  .header-text { display: flex; flex-direction: column; }
  .nav-select-mini { background: #444; color: #ccc; border: none; font-size: 0.7rem; padding: 0.2rem; margin: 0; border-radius: 4px; }
  h1 { margin: 0; font-size: 1.2rem; }
  .badge { font-size: 0.7rem; padding: 0.2rem 0.5rem; border-radius: 4px; font-weight: bold; }
  .badge.superuser { background: #f44336; color: white; }
  .badge.verified { background: #4caf50; color: white; }
  .section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; }
  .refresh-btn { background: #666; font-size: 0.8rem; padding: 0.4rem 0.8rem; color: white; border: none; border-radius: 4px; cursor: pointer; }
  .users-grid { display: grid; gap: 1rem; }
  .user-card { background: white; padding: 1rem; border-radius: 4px; display: flex; justify-content: space-between; align-items: center; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
  .user-info { display: flex; flex-direction: column; }
  .status { font-size: 0.8rem; font-weight: bold; margin-top: 0.2rem; }
  .status.verified { color: green; }
  .status.pending { color: orange; }
  .date { font-size: 0.7rem; color: #999; }
  .user-actions { display: flex; gap: 0.5rem; }
  .verify-btn { background: #2196F3; font-size: 0.8rem; padding: 0.4rem 0.8rem; color: white; border: none; border-radius: 4px; cursor: pointer; }
  .users-btn { background: #ff9800; font-size: 0.9rem; padding: 0.5rem 1rem; width: auto; color: white; border: none; border-radius: 4px; cursor: pointer; }
  .pending-notice { background: #fff3cd; border: 1px solid #ffeeba; color: #856404; padding: 1.5rem; border-radius: 8px; margin-bottom: 2rem; text-align: center; }
  .login-box { max-width: 400px; margin: 4rem auto; padding: 2rem; background: white; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); text-align: center; }
  .login-info { color: #666; font-size: 0.9rem; margin-bottom: 1.5rem; }
  .toggle-mode { margin-top: 1rem; font-size: 0.9rem; }
  .link-btn { background: none; color: #2196F3; border: none; padding: 0 0.5rem; cursor: pointer; font-weight: bold; text-decoration: underline; }
  .back-home-link { display: block; margin-top: 1rem; color: #666; text-decoration: none; font-size: 0.85rem; }
  input, select, textarea { width: 100%; padding: 0.8rem; margin-bottom: 1rem; border: 1px solid #ddd; border-radius: 4px; box-sizing: border-box; }
  button { padding: 0.8rem 1.5rem; border: none; border-radius: 4px; background: #4CAF50; color: white; cursor: pointer; }
  button:disabled { background: #ccc; }
  .logout-btn { background: #666; font-size: 0.8rem; padding: 0.5rem 1rem; }
  .del-btn { background: #ff4444; margin-left: 0.5rem; width: auto; padding: 0.5rem 0.8rem; }
  .back-btn { background: #ddd; color: #333; width: auto; padding: 0.5rem 1rem; margin-right: 1rem; cursor: pointer; transition: background 0.2s; }
  .back-btn:hover { background: #ccc; }
  .dashboard { padding: 2rem; max-width: 800px; margin: 0 auto; width: 100%; overflow-y: auto; }
  .create-game { background: white; padding: 1.5rem; border-radius: 8px; margin-bottom: 2rem; box-shadow: 0 2px 4px rgba(0,0,0,0.05); }
  .games-list ul { list-style: none; padding: 0; }
  .games-list li { background: white; padding: 1rem; margin-bottom: 0.5rem; border-radius: 4px; display: flex; justify-content: space-between; align-items: center; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
  .game-info { display: flex; flex-direction: column; }
  .game-title-row { display: flex; align-items: center; gap: 0.8rem; }
  .nav-badge { font-size: 0.65rem; padding: 2px 6px; border-radius: 4px; font-weight: bold; text-transform: uppercase; }
  .nav-badge.map { background: #e3f2fd; color: #1976d2; border: 1px solid #bbdefb; }
  .nav-badge.dist { background: #f1f8e9; color: #388e3c; border: 1px solid #dcedc8; }
  .desc { font-size: 0.85rem; color: #666; }
  .total-dist-badge { font-size: 0.75rem; color: #4caf50; font-weight: bold; margin-top: 0.2rem; }
  .editor-layout { display: flex; flex: 1; overflow: hidden; }
  .sidebar { width: 320px; background: white; border-right: 1px solid #ddd; display: flex; flex-direction: column; flex-shrink: 0; }
  .sidebar-header { padding: 1rem; border-bottom: 1px solid #eee; display: flex; align-items: flex-start; }
  .clickable-title { margin: 0; cursor: pointer; }
  .clickable-title:hover { color: #2196F3; }
  .clickable-desc { font-size: 0.75rem; color: #666; margin: 0.2rem 0 0.5rem 0; cursor: pointer; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 200px; }
  .clickable-desc:hover { color: #2196F3; }
  .track-info-editor { display: flex; flex-direction: column; gap: 0.3rem; margin-bottom: 0.5rem; }
  .track-edit-input { font-size: 0.9rem; padding: 0.4rem; margin: 0; }
  .track-edit-desc { font-size: 0.75rem; padding: 0.4rem; margin: 0; }
  .track-edit-actions { display: flex; gap: 0.3rem; }
  .save-btn-mini { background: #4CAF50; padding: 0.3rem 0.6rem; font-size: 0.75rem; }
  .cancel-btn-mini { background: #999; padding: 0.3rem 0.6rem; font-size: 0.75rem; }
  .map-wrapper { flex: 1; position: relative; }
  .points-list { flex: 1; overflow-y: auto; padding: 1rem; }
  .list-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; }
  .route-options select { margin: 0; padding: 0.4rem; font-size: 0.9rem; }
  .points-list ul { list-style: none; padding: 0; }
  .points-list li { background: #fff; border: 1px solid #eee; border-radius: 4px; margin-bottom: 0.5rem; cursor: move; }
  .point-row { display: flex; align-items: center; padding: 0.5rem; }
  .points-list li:hover { background: #f9f9f9; border-color: #ddd; }
  .drag-handle { cursor: grab; color: #bbb; margin-right: 0.5rem; font-size: 1.2rem; }
  .point-btn { flex: 1; background: transparent; color: #333; text-align: left; padding: 0; display: flex; align-items: center; overflow: hidden; border: none; }
  .point-num { background: #eee; width: 20px; height: 20px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 0.8rem; margin-right: 0.5rem; color: #666; flex-shrink: 0; }
  .point-name-display { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-size: 0.9rem; }
  .active .point-num { background: #2196F3; color: white; }
  .active .point-btn { font-weight: bold; color: #2196F3; }
  .distance-info { font-size: 0.75rem; color: #888; text-align: center; padding: 0.2rem; background: #f4f4f4; border-top: 1px dashed #eee; }
  .point-editor { background: #f0f0f0; padding: 1rem; border-top: 2px solid #ccc; margin-top: auto; overflow-y: auto; max-height: 75%; flex-shrink: 0; box-shadow: 0 -2px 10px rgba(0,0,0,0.1); }
  .point-editor h4 { margin-top: 0; margin-bottom: 0.8rem; }
  .editor-actions { display: flex; gap: 0.5rem; padding-top: 0.8rem; margin-top: 0.5rem; border-top: 1px solid #ccc; position: sticky; bottom: -1rem; background: #f0f0f0; padding-bottom: 0.5rem; }
  .save-btn { flex: 2; margin: 0 !important; background: #2196F3 !important; }
  .cancel-btn { flex: 1; margin: 0 !important; background: #999 !important; }
  .checkbox-label { display: flex; align-items: center; gap: 0.3rem; font-size: 0.8rem; padding-bottom: 1.2rem; white-space: nowrap; }
  .checkbox-label input { width: auto; margin: 0; }
  .error { color: red; margin-top: 1rem; font-weight: bold; }
  .toast-error { position: fixed; bottom: 20px; right: 20px; background: #ff4444; color: white; padding: 1rem; border-radius: 4px; z-index: 1000; box-shadow: 0 4px 12px rgba(0,0,0,0.2); }
  .toast-success { position: fixed; bottom: 20px; right: 20px; background: #4caf50; color: white; padding: 1rem; border-radius: 4px; z-index: 1000; box-shadow: 0 4px 12px rgba(0,0,0,0.2); }
  .hint { font-size: 0.8rem; color: #666; font-style: italic; text-align: center; margin-top: 2rem; }
</style>
