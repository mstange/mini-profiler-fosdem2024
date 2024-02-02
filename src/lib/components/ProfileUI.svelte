<script lang="ts">
	import CategoryBreakdownC from './CategoryBreakdown.svelte';
	import HeaviestStack from './HeaviestStack.svelte';
	import Timeline from './Timeline.svelte';
	import ProfileSamplesVisualization from './ProfileSamplesVisualization.svelte';
	import type { TimeRange, CategoryBreakdown, Stack } from '$lib/types';

	export let baseRange: TimeRange;
	export let graph: Float32Array;
	export let overallSampleCount: number;
	export let selectedSampleCount: number;
	export let total: number;
	export let categoryBreakdown: CategoryBreakdown;
	export let categoryBreakdownThroughput: number;
	export let heaviestStack: Stack;
	export let heaviestStackThroughput: number;
</script>

<div>
	<Timeline {baseRange} on:rangeupdate>
		<ProfileSamplesVisualization {graph} />
	</Timeline>
	<p>{overallSampleCount} samples overall, {selectedSampleCount} in selection</p>
	<p>
		Throughput of computing the category breakdown: {categoryBreakdownThroughput.toFixed(1)} nanoseconds per sample
	</p>
	<p>Throughput of computing the heaviest stack: {heaviestStackThroughput.toFixed(1)} nanoseconds per sample</p>
	<div class="details">
		<CategoryBreakdownC {categoryBreakdown} {total} />
		<HeaviestStack {heaviestStack} />
	</div>
</div>

<style>
	.details {
		display: flex;
		flex-flow: row nowrap;
	}
</style>
