import { ThroughputAccumulator, bisectionLeftByKey } from '$lib';

import type {
	Stack,
	CategoryBreakdown,
	TimeRange,
	SampleIndexRange,
	ProfileInfo
} from '$lib/types';

export type Profile = {
	samples: Sample[];
};

export type Sample = {
	time: number;
	stack: Stack;
	weight: number;
};

export function computeBaseRange(profile: Profile): TimeRange {
	const start = profile.samples[0].time;
	const end = profile.samples[profile.samples.length - 1].time;
	return { start, end };
}

function computeProfileGraph(profile: Profile): Float32Array {
	const { start, end } = computeBaseRange(profile);
	const depths = new Int32Array(800);
	let maxDepth = 0;
	for (let i = 0; i < profile.samples.length; i++) {
		const { time, stack } = profile.samples[i];
		const index = Math.floor(((time - start) / (end - start)) * depths.length);
		const stackDepth = stack.length;
		maxDepth = Math.max(maxDepth, stackDepth);
		depths[index] = Math.max(depths[index], stackDepth);
	}
	const graph = new Float32Array(depths.length);
	for (let i = 0; i < depths.length; i++) {
		graph[i] = depths[i] / maxDepth;
	}
	return graph;
}

export function convertTimeRangeToSampleIndexRange(
	profile: Profile,
	timeRange: TimeRange
): SampleIndexRange {
	// Use binary search to find the start and end indices.
	// The profile samples are sorted by time.
	const { samples } = profile;
	const startIndex = bisectionLeftByKey(samples, (sample) => sample.time, timeRange.start);
	const endIndex = bisectionLeftByKey(samples, (sample) => sample.time, timeRange.end);
	return {
		start: startIndex,
		end: endIndex
	};
}

export function computeTotal(profile: Profile, range: SampleIndexRange): number {
	let absSum = 0;
	for (let i = range.start; i < range.end; i++) {
		const { weight } = profile.samples[i];
		absSum += Math.abs(weight);
	}
	return absSum;
}

export function computeCategoryBreakdown(
	profile: Profile,
	range: SampleIndexRange
): CategoryBreakdown {
	const map = new Map();
	for (let i = range.start; i < range.end; i++) {
		const { stack, weight } = profile.samples[i];
		const topFrame = stack[0];
		const category = topFrame.category;
		map.set(category, (map.get(category) ?? 0) + weight);
	}
	return map;
}

export function computeHeaviestStack(profile: Profile, range: SampleIndexRange): Stack {
	const map = new Map();
	let heaviestStackWeight = 0;
	let heaviestStack: Stack = [];
	for (let i = range.start; i < range.end; i++) {
		const { stack, weight } = profile.samples[i];
		const stackJsonString = JSON.stringify(stack);
		const stackWeight = (map.get(stackJsonString) || 0) + weight;
		map.set(stackJsonString, stackWeight);
		if (stackWeight > heaviestStackWeight) {
			heaviestStackWeight = stackWeight;
			heaviestStack = stack;
		}
	}
	return heaviestStack;
}

export type Selectors = {
	computeBaseRange: (profile: Profile) => TimeRange;
	computeProfileGraph: (profile: Profile) => Float32Array;
	convertTimeRangeToSampleIndexRange: (profile: Profile, timeRange: TimeRange) => SampleIndexRange;
	getInfoForProfile: (profile: Profile, sampleIndexRange: SampleIndexRange) => ProfileInfo;
};

export function makeSelectorsV1(): Selectors {
	const categoryBreakdownThroughputAccumulator = new ThroughputAccumulator();
	const heaviestStackThroughputAccumulator = new ThroughputAccumulator();

	return {
		computeBaseRange,
		computeProfileGraph,
		convertTimeRangeToSampleIndexRange,
		getInfoForProfile: function computeInfo(
			profile: Profile,
			sampleIndexRange: SampleIndexRange
		): ProfileInfo {
			const selectedSampleCount = sampleIndexRange.end - sampleIndexRange.start;
			const total = computeTotal(profile, sampleIndexRange);
			const categoryBreakdown = categoryBreakdownThroughputAccumulator.measure(
				selectedSampleCount,
				() => computeCategoryBreakdown(profile, sampleIndexRange)
			);
			const heaviestStack = heaviestStackThroughputAccumulator.measure(selectedSampleCount, () =>
				computeHeaviestStack(profile, sampleIndexRange)
			);
			return {
				overallSampleCount: profile.samples.length,
				selectedSampleCount,
				total,
				categoryBreakdown,
				categoryBreakdownThroughput: categoryBreakdownThroughputAccumulator.get(),
				heaviestStack,
				heaviestStackThroughput: heaviestStackThroughputAccumulator.get()
			};
		}
	};
}
