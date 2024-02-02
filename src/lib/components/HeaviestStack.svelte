<script lang="ts">
	import type { Stack } from '$lib/types';

	export let heaviestStack: Stack;
</script>

<div class="heaviest-stack">
	<h2>Heaviest Stack</h2>
	<ol>
		{#each heaviestStack as { name }}
			<li>
				{name}
			</li>
		{/each}
	</ol>
</div>

<style>
	.heaviest-stack {
		flex-flow: column nowrap;
		width: 400px;
	}

  ol {
    list-style-type: none;
    padding: 0;
  }

	li {
		overflow: hidden;
    white-space: nowrap;
		text-overflow: ellipsis;
	}
</style>
