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
	stacks: StackNode[];
	frames: Frame[];
	categories: string[];
};

export type Sample = {
	time: number;
	stackIndex: number;
	weight: number;
};

export type StackNode = {
	parentStackIndex: number | null;
	frameIndex: number;
};

export type Frame = {
	name: string;
	categoryIndex: number;
};

export function computeBaseRange(profile: Profile): TimeRange {
	const start = profile.samples[0].time;
	const end = profile.samples[profile.samples.length - 1].time;
	return { start, end };
}

function computeProfileGraph(profile: Profile): Float32Array {
	const stackDepthColumn = new Int32Array(profile.stacks.length);
	for (let i = 0; i < profile.stacks.length; i++) {
		const parentStackIndex = profile.stacks[i].parentStackIndex;
		const depth = parentStackIndex === null ? 0 : stackDepthColumn[parentStackIndex] + 1;
		stackDepthColumn[i] = depth;
	}
	const { start, end } = computeBaseRange(profile);
	const depths = new Int32Array(800);
	let maxDepth = 0;
	for (let i = 0; i < profile.samples.length; i++) {
		const { time, stackIndex } = profile.samples[i];
		const index = Math.floor(((time - start) / (end - start)) * depths.length);
		const stackDepth = stackDepthColumn[stackIndex];
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

export function computeCategoryBreakdownWithStringKeyMap(
	profile: Profile,
	range: SampleIndexRange
): CategoryBreakdown {
	const map = new Map();
	for (let i = range.start; i < range.end; i++) {
		const { stackIndex, weight } = profile.samples[i];
		const frameIndex = profile.stacks[stackIndex].frameIndex;
		const categoryIndex = profile.frames[frameIndex].categoryIndex;
		const category = profile.categories[categoryIndex];
		map.set(category, (map.get(category) || 0) + weight);
	}
	return map;
}

export function computeCategoryBreakdownWithIndexKeyMap(
	profile: Profile,
	range: SampleIndexRange
): CategoryBreakdown {
	const map = new Map();
	for (let i = range.start; i < range.end; i++) {
		const { stackIndex, weight } = profile.samples[i];
		const frameIndex = profile.stacks[stackIndex].frameIndex;
		const categoryIndex = profile.frames[frameIndex].categoryIndex;
		map.set(categoryIndex, (map.get(categoryIndex) || 0) + weight);
	}
	return new Map(
		[...map.entries()].map(([categoryIndex, weight]) => [profile.categories[categoryIndex], weight])
	);
}

export function computeCategoryBreakdownWithTypedArray(
	profile: Profile,
	range: SampleIndexRange
): CategoryBreakdown {
	const map = new Float64Array(profile.categories.length);
	for (let i = range.start; i < range.end; i++) {
		const { stackIndex, weight } = profile.samples[i];
		const frameIndex = profile.stacks[stackIndex].frameIndex;
		const categoryIndex = profile.frames[frameIndex].categoryIndex;
		map[categoryIndex] += weight;
	}
	return new Map(
		[...map.entries()].map(([categoryIndex, weight]) => [profile.categories[categoryIndex], weight])
	);
}

export function computeHeaviestStackIndexWithMap(
	profile: Profile,
	range: SampleIndexRange
): number | null {
	const map = new Map();
	let heaviestStackWeight = 0;
	let heaviestStackIndex: number | null = null;
	for (let i = range.start; i < range.end; i++) {
		const { stackIndex, weight } = profile.samples[i];
		const stackWeight = (map.get(stackIndex) ?? 0) + weight;
		map.set(stackIndex, stackWeight);
		if (stackWeight > heaviestStackWeight) {
			heaviestStackWeight = stackWeight;
			heaviestStackIndex = stackIndex;
		}
	}
	return heaviestStackIndex;
}

export function computeHeaviestStackIndexWithTypedArray(
	profile: Profile,
	range: SampleIndexRange
): number | null {
	const map = new Float64Array(profile.stacks.length);
	let heaviestStackWeight = 0;
	let heaviestStackIndex: number | null = null;
	for (let i = range.start; i < range.end; i++) {
		const { stackIndex, weight } = profile.samples[i];
		const stackWeight = map[stackIndex] + weight;
		map[stackIndex] = stackWeight;
		if (stackWeight > heaviestStackWeight) {
			heaviestStackWeight = stackWeight;
			heaviestStackIndex = stackIndex;
		}
	}
	return heaviestStackIndex;
}

// Convert stack index into an array of frames.
export function convertStackIndexToStack(profile: Profile, stackIndex: number | null): Stack {
	const heaviestStack: Stack = [];
	let currentStackIndex = stackIndex;
	while (currentStackIndex !== null) {
		const { frameIndex, parentStackIndex } = profile.stacks[currentStackIndex];
		const { name, categoryIndex } = profile.frames[frameIndex];
		const category = profile.categories[categoryIndex];
		heaviestStack.push({ name, category });
		currentStackIndex = parentStackIndex;
	}
	return heaviestStack;
}

export type Selectors = {
	computeBaseRange: (profile: Profile) => TimeRange;
	computeProfileGraph: (profile: Profile) => Float32Array;
	convertTimeRangeToSampleIndexRange: (profile: Profile, timeRange: TimeRange) => SampleIndexRange;
	getInfoForProfile: (profile: Profile, sampleIndexRange: SampleIndexRange) => ProfileInfo;
};

export function makeSelectorsV2Basic(): Selectors {
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
				() => computeCategoryBreakdownWithStringKeyMap(profile, sampleIndexRange)
			);
			const heaviestStack = heaviestStackThroughputAccumulator.measure(selectedSampleCount, () =>
				convertStackIndexToStack(
					profile,
					computeHeaviestStackIndexWithMap(profile, sampleIndexRange)
				)
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

export function makeSelectorsV2CategoryIndexKey(): Selectors {
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
				() => computeCategoryBreakdownWithIndexKeyMap(profile, sampleIndexRange)
			);
			const heaviestStack = heaviestStackThroughputAccumulator.measure(selectedSampleCount, () =>
				convertStackIndexToStack(
					profile,
					computeHeaviestStackIndexWithMap(profile, sampleIndexRange)
				)
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

export function makeSelectorsV2TypedArrayMaps(): Selectors {
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
				() => computeCategoryBreakdownWithTypedArray(profile, sampleIndexRange)
			);
			const heaviestStack = heaviestStackThroughputAccumulator.measure(selectedSampleCount, () =>
				convertStackIndexToStack(
					profile,
					computeHeaviestStackIndexWithTypedArray(profile, sampleIndexRange)
				)
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
