<script lang="ts">
  interface Props {
    data?: unknown;
    error?: string | null;
    loading?: boolean;
    title?: string;
  }

  let { data = null, error = null, loading = false, title = "Result" }: Props = $props();
</script>

{#if loading}
  <div class="result">
    <p class="muted">Working...</p>
  </div>
{:else if error}
  <div class="result result-error">
    <h3>Error</h3>
    <p>{error}</p>
  </div>
{:else if data}
  <div class="result result-success">
    <h3>{title}</h3>
    <pre>{JSON.stringify(data, null, 2)}</pre>
  </div>
{/if}
