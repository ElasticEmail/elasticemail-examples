<script>
  let { title, description, sourcePath } = $props();
</script>

<div class="page-header">
  <a href="/" class="muted">&larr; Back to examples</a>
  <h1>{title}</h1>
  <p class="muted">{description}</p>
  {#if sourcePath}
    <a
      href="https://github.com/ElasticEmail/elasticemail-examples/blob/main/sveltekit-elasticemail-examples/javascript/{sourcePath}"
      target="_blank"
      rel="noopener noreferrer"
      class="muted"
    >
      View source &rarr;
    </a>
  {/if}
</div>
