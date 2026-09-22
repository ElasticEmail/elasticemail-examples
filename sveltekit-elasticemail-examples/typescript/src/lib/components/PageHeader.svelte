<script lang="ts">
  interface Props {
    title: string;
    description: string;
    sourcePath?: string;
  }

  let { title, description, sourcePath }: Props = $props();
</script>

<div class="page-header">
  <a href="/" class="muted">&larr; Back to examples</a>
  <h1>{title}</h1>
  <p class="muted">{description}</p>
  {#if sourcePath}
    <a
      href="https://github.com/ElasticEmail/elasticemail-examples/blob/main/sveltekit-elasticemail-examples/typescript/{sourcePath}"
      target="_blank"
      rel="noopener noreferrer"
      class="muted"
    >
      View source &rarr;
    </a>
  {/if}
</div>
