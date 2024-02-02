<script lang="ts">
	import type { CategoryBreakdown } from'$lib/types';

	type CategoryBreakdownItem = {
		category: string;
		fraction: number;
	};

  function computeOrderedCategoryBreakdown(categoryBreakdown: CategoryBreakdown, total: number): CategoryBreakdownItem[] {
    return [...categoryBreakdown.entries()]
      .map(([category, value]) => ({ category, value, fraction: value / total }))
      .sort((a, b) => b.value - a.value);
  }

	export let categoryBreakdown: CategoryBreakdown;
	export let total: number;
	$: orderedCategoryBreakdown = computeOrderedCategoryBreakdown(categoryBreakdown, total);
</script>

<div class="category-breakdown">
	<h2>Category Breakdown</h2>
	<ol>
		{#each orderedCategoryBreakdown as { category, fraction }}
			<li>
				{category} ({(fraction * 100).toFixed(1)}%)
			</li>
		{/each}
	</ol>
</div>

<style>
  .category-breakdown {
    display: flex;
    flex-flow: column nowrap;
    width: 400px;
  }
</style>
