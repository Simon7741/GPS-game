<script lang="ts">
  interface Props {
    onReset: () => void;
  }
  let { onReset }: Props = $props();
</script>

<div class="success-page">
  <div class="icon">🏆</div>
  <h2>Target Reached!</h2>
  <p>Excellent work! You've successfully navigated to the secret coordinates.</p>
  
  <div class="stats">
    <div class="stat-item">
      <span>Accuracy</span>
      <strong>High</strong>
    </div>
    <div class="stat-item">
      <span>Status</span>
      <strong>Completed</strong>
    </div>
  </div>

  <button onclick={onReset}>Start New Quest</button>
</div>

<style>
  .success-page {
    animation: slideUp 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    background: linear-gradient(145deg, #2a2a2a, #333);
    padding: 3rem 2rem;
    border-radius: 24px;
    border: 2px solid #4CAF50;
    box-shadow: 0 20px 40px rgba(0,0,0,0.5);
    text-align: center;
  }

  .icon {
    font-size: 5rem;
    margin-bottom: 1rem;
    filter: drop-shadow(0 0 10px rgba(76, 175, 80, 0.5));
  }

  h2 {
    color: #4CAF50;
    font-size: 2rem;
    margin: 0 0 1rem 0;
  }

  p {
    color: #ccc;
    line-height: 1.6;
    margin-bottom: 2rem;
  }

  .stats {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
    margin-bottom: 2.5rem;
  }

  .stat-item {
    background: rgba(0, 0, 0, 0.2);
    padding: 1rem;
    border-radius: 12px;
    display: flex;
    flex-direction: column;
  }

  .stat-item span {
    font-size: 0.8rem;
    color: #888;
    text-transform: uppercase;
  }

  .stat-item strong {
    font-size: 1.1rem;
    color: #fff;
  }

  button {
    background: #4CAF50;
    color: white;
    border: none;
    padding: 1.2rem 2rem;
    font-size: 1.1rem;
    font-weight: bold;
    border-radius: 14px;
    cursor: pointer;
    width: 100%;
    transition: transform 0.2s;
  }

  button:active {
    transform: scale(0.98);
  }

  @keyframes slideUp {
    from { opacity: 0; transform: translateY(40px); }
    to { opacity: 1; transform: translateY(0); }
  }
</style>
