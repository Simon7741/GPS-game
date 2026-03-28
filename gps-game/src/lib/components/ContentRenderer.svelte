<script lang="ts">
  import katex from 'katex';
  import 'katex/dist/katex.min.css';

  interface Props {
    text?: string;
    image?: string;
  }

  let { text, image }: Props = $props();

  function renderText(text: string) {
    if (!text) return '';
    // Simple regex for inline math: $...$
    // Note: Does not handle escaped $ or complex nesting well, but sufficient for basic usage.
    const parts = text.split(/(\$[^\$]+\$)/g);
    
    return parts.map(part => {
      if (part.startsWith('$') && part.endsWith('$')) {
        const math = part.slice(1, -1);
        try {
          return katex.renderToString(math, { throwOnError: false });
        } catch (e) {
          return `<span class="error">LaTeX Error</span>`;
        }
      } else {
        // Escape HTML to prevent XSS if we render as HTML
        return part
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
      }
    }).join('');
  }
</script>

<div class="content-renderer">
  {#if text}
    <div class="clue-text">
      {@html renderText(text)}
    </div>
  {/if}
  {#if image}
    <img src={image} alt="Clue" class="clue-image" />
  {/if}
</div>

<style>
  .content-renderer {
    width: 100%;
    text-align: center;
  }
  
  .clue-image {
    max-width: 100%;
    max-height: 400px;
    border-radius: 8px;
    box-shadow: 0 4px 8px rgba(0,0,0,0.2);
  }

  .clue-text {
    font-size: 1.2rem;
    line-height: 1.6;
    color: #333; /* Or inherit */
    text-align: left;
    background: #f9f9f9; /* Light background for text readability if on dark theme */
    padding: 1rem;
    border-radius: 8px;
    color: #222;
  }

  /* Override for dark mode if parent handles it, or explicit styles */
  :global(.dark) .clue-text {
      background: #333;
      color: #eee;
  }
</style>
