import { ThroughputAccumulator, bisectionLeft } from '$lib';
import memoize from 'memoize-one';

import type {
	Stack,
	CategoryBreakdown,
	TimeRange,
	SampleIndexRange,
	ProfileInfo
} from '$lib/types';

export type Profile = {
	sampleTable: SampleTable;
	stackTable: StackTable;
	frameTable: FrameTable;
	categories: string[];
};

export type SampleTable = {
	length: number;
	timeColumn: number[];
	stackIndexColumn: number[];
	weightColumn: number[];
};

export type StackTable = {
	length: number;
	parentStackIndexColumn: Array<number | null>;
	frameIndexColumn: number[];
};

export type FrameTable = {
	length: number;
	nameColumn: string[];
	categoryIndexColumn: number[];
};

function computeBaseRange(profile: Profile): TimeRange {
	const start = profile.sampleTable.timeColumn[0];
	const end = profile.sampleTable.timeColumn[profile.sampleTable.length - 1];
	return { start, end };
}

function computeProfileGraph(profile: Profile): Float32Array {
	const stackDepthColumn = new Int32Array(profile.stackTable.length);
	for (let i = 0; i < profile.stackTable.length; i++) {
		const parentStackIndex = profile.stackTable.parentStackIndexColumn[i];
		const depth = parentStackIndex === null ? 0 : stackDepthColumn[parentStackIndex] + 1;
		stackDepthColumn[i] = depth;
	}
	const { start, end } = computeBaseRange(profile);
	const depths = new Int32Array(800);
	let maxDepth = 0;
	for (let i = 0; i < profile.sampleTable.length; i++) {
		const time = profile.sampleTable.timeColumn[i];
		const stackIndex = profile.sampleTable.stackIndexColumn[i];
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

function convertTimeRangeToSampleIndexRange(
	profile: Profile,
	timeRange: TimeRange
): SampleIndexRange {
	// Use binary search to find the start and end indices.
	// The profile samples are sorted by time.
	const { sampleTable } = profile;
	const startIndex = bisectionLeft(sampleTable.timeColumn, timeRange.start);
	const endIndex = bisectionLeft(sampleTable.timeColumn, timeRange.end);
	return {
		start: startIndex,
		end: endIndex
	};
}

function computeTotalBasic(profile: Profile, range: SampleIndexRange): number {
	let absSum = 0;
	for (let i = range.start; i < range.end; i++) {
		const weight = profile.sampleTable.weightColumn[i];
		absSum += Math.abs(weight);
	}
	return absSum;
}

function computeTotalTypedArray(
	weightColumn: Float64Array,
	range: SampleIndexRange
): number {
	let absSum = 0;
	for (let i = range.start; i < range.end; i++) {
		const weight = weightColumn[i];
		absSum += Math.abs(weight);
	}
	return absSum;
}

function computeCategoryBreakdownBasic(
	profile: Profile,
	range: SampleIndexRange
): Float64Array {
	const map = new Float64Array(profile.categories.length);
	for (let i = range.start; i < range.end; i++) {
		const stackIndex = profile.sampleTable.stackIndexColumn[i];
		const weight = profile.sampleTable.weightColumn[i];
		const frameIndex = profile.stackTable.frameIndexColumn[stackIndex];
		const categoryIndex = profile.frameTable.categoryIndexColumn[frameIndex];
		map[categoryIndex] += weight;
	}
	return map;
}

function computeCategoryBreakdownWithPrecomputedSampleStacksRegularArray(
	profile: Profile,
	sampleCategories: number[],
	weightColumn: number[],
	range: SampleIndexRange
): Float64Array {
	const map = new Float64Array(profile.categories.length);
	for (let i = range.start; i < range.end; i++) {
		const weight = weightColumn[i];
		const categoryIndex = sampleCategories[i];
		map[categoryIndex] += weight;
	}
	return map;
}

function computeCategoryBreakdownWithPrecomputedSampleStacksTypedArray(
	profile: Profile,
	sampleCategories: Uint8Array,
	weightColumn: Float64Array,
	range: SampleIndexRange
): Float64Array {
	const map = new Float64Array(profile.categories.length);
	for (let i = range.start; i < range.end; i++) {
		const weight = weightColumn[i];
		const categoryIndex = sampleCategories[i];
		map[categoryIndex] += weight;
	}
	return map;
}

function convertCategoryBreakdownTypedArrayToMap(
	profile: Profile,
	categoryBreakdown: Float64Array
): CategoryBreakdown {
	return new Map(
		[...categoryBreakdown.entries()].map(([categoryIndex, weight]) => [
			profile.categories[categoryIndex],
			weight
		])
	);
}

function computeHeaviestStackIndexWithRegularArrays(
	stackCount: number,
	sampleStacks: number[],
	sampleWeights: number[],
	range: SampleIndexRange
): number | null {
	const { start: rangeStart, end: rangeEnd } = range;
	const map = new Float64Array(stackCount);
	let heaviestStackWeight = 0;
	let heaviestStackIndex: number = -1;
	for (let i = rangeStart; i < rangeEnd; i++) {
		const stackIndex = sampleStacks[i];
		const weight = sampleWeights[i];
		const stackWeight = map[stackIndex] + weight;
		map[stackIndex] = stackWeight;
		if (stackWeight > heaviestStackWeight) {
			heaviestStackWeight = stackWeight;
			heaviestStackIndex = stackIndex;
		}
	}
	return heaviestStackIndex === -1 ? null : heaviestStackIndex;
}

function computeHeaviestStackIndexWithTypedArrays(
	stackCount: number,
	sampleStacks: Int32Array,
	sampleWeights: Float64Array,
	range: SampleIndexRange
): number | null {
	const { start: rangeStart, end: rangeEnd } = range;
	const map = new Float64Array(stackCount);
	let heaviestStackWeight = 0;
	let heaviestStackIndex: number = -1;
	for (let i = rangeStart; i < rangeEnd; i++) {
		const stackIndex = sampleStacks[i];
		const weight = sampleWeights[i];
		const stackWeight = map[stackIndex] + weight;
		map[stackIndex] = stackWeight;
		if (stackWeight > heaviestStackWeight) {
			heaviestStackWeight = stackWeight;
			heaviestStackIndex = stackIndex;
		}
	}
	return heaviestStackIndex === -1 ? null : heaviestStackIndex;
}

// Convert stack index into an array of frames.
function convertStackIndexToStack(profile: Profile, stackIndex: number | null): Stack {
	const stack: Stack = [];
	let currentStackIndex = stackIndex;
	while (currentStackIndex !== null) {
		const frameIndex = profile.stackTable.frameIndexColumn[currentStackIndex];
		const categoryIndex = profile.frameTable.categoryIndexColumn[frameIndex];
		const category = profile.categories[categoryIndex];
		const name = profile.frameTable.nameColumn[frameIndex];
		const parentStackIndex = profile.stackTable.parentStackIndexColumn[currentStackIndex];
		stack.push({ name, category });
		currentStackIndex = parentStackIndex;
	}
	return stack;
}

export type Selectors = {
	computeBaseRange: (profile: Profile) => TimeRange;
	computeProfileGraph: (profile: Profile) => Float32Array;
	convertTimeRangeToSampleIndexRange: (profile: Profile, timeRange: TimeRange) => SampleIndexRange;
	getInfoForProfile: (profile: Profile, sampleIndexRange: SampleIndexRange) => ProfileInfo;
};

export function makeSelectorsV3Basic(): Selectors {
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
			const total = computeTotalBasic(profile, sampleIndexRange);
			const categoryBreakdownTypedArray = categoryBreakdownThroughputAccumulator.measure(
				selectedSampleCount,
				() => computeCategoryBreakdownBasic(profile, sampleIndexRange)
			);
			const categoryBreakdown = convertCategoryBreakdownTypedArrayToMap(
				profile,
				categoryBreakdownTypedArray
			);
			const heaviestStackIndex = heaviestStackThroughputAccumulator.measure(
				selectedSampleCount,
				() =>
					computeHeaviestStackIndexWithRegularArrays(
						profile.stackTable.length,
						profile.sampleTable.stackIndexColumn,
						profile.sampleTable.weightColumn,
						sampleIndexRange
					)
			);
			const heaviestStack = convertStackIndexToStack(profile, heaviestStackIndex);
			return {
				overallSampleCount: profile.sampleTable.length,
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

export function makeSelectorsV3MemoizedSampleCategories(): Selectors {
	const categoryBreakdownThroughputAccumulator = new ThroughputAccumulator();
	const heaviestStackThroughputAccumulator = new ThroughputAccumulator();

	const getSampleCategories = memoize((profile: Profile): number[] => {
		const sampleCategories = new Array(profile.sampleTable.length);
		for (let i = 0; i < sampleCategories.length; i++) {
			const stackIndex = profile.sampleTable.stackIndexColumn[i];
			const frameIndex = profile.stackTable.frameIndexColumn[stackIndex];
			const categoryIndex = profile.frameTable.categoryIndexColumn[frameIndex];
			sampleCategories[i] = categoryIndex;
		}
		return sampleCategories;
	});

	return {
		computeBaseRange,
		computeProfileGraph,
		convertTimeRangeToSampleIndexRange,
		getInfoForProfile: function computeInfo(
			profile: Profile,
			sampleIndexRange: SampleIndexRange
		): ProfileInfo {
			const selectedSampleCount = sampleIndexRange.end - sampleIndexRange.start;
			const sampleCategories = getSampleCategories(profile);
			const total = computeTotalBasic(profile, sampleIndexRange);
			const categoryBreakdownTypedArray = categoryBreakdownThroughputAccumulator.measure(
				selectedSampleCount,
				() =>
					computeCategoryBreakdownWithPrecomputedSampleStacksRegularArray(
						profile,
						sampleCategories,
						profile.sampleTable.weightColumn,
						sampleIndexRange
					)
			);
			const categoryBreakdown = convertCategoryBreakdownTypedArrayToMap(
				profile,
				categoryBreakdownTypedArray
			);
			const heaviestStackIndex = heaviestStackThroughputAccumulator.measure(
				selectedSampleCount,
				() =>
					computeHeaviestStackIndexWithRegularArrays(
						profile.stackTable.length,
						profile.sampleTable.stackIndexColumn,
						profile.sampleTable.weightColumn,
						sampleIndexRange
					)
			);
			const heaviestStack = convertStackIndexToStack(profile, heaviestStackIndex);
			return {
				overallSampleCount: profile.sampleTable.length,
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

export function makeSelectorsV3MemoizedTypedArrayInputs(): Selectors {
	const categoryBreakdownThroughputAccumulator = new ThroughputAccumulator();
	const heaviestStackThroughputAccumulator = new ThroughputAccumulator();

	const getSampleStacks = memoize(
		(profile: Profile) => new Int32Array(profile.sampleTable.stackIndexColumn)
	);
	const getSampleWeights = memoize(
		(profile: Profile) => new Float64Array(profile.sampleTable.weightColumn)
	);
	const getSampleCategories = memoize((profile: Profile) => {
		const sampleStacks = getSampleStacks(profile);
		const sampleCategories = new Uint8Array(profile.sampleTable.length);
		for (let i = 0; i < sampleCategories.length; i++) {
			const stackIndex = sampleStacks[i];
			const frameIndex = profile.stackTable.frameIndexColumn[stackIndex];
			const categoryIndex = profile.frameTable.categoryIndexColumn[frameIndex];
			sampleCategories[i] = categoryIndex;
		}
		return sampleCategories;
	});

	return {
		computeBaseRange,
		computeProfileGraph,
		convertTimeRangeToSampleIndexRange,
		getInfoForProfile: function computeInfo(
			profile: Profile,
			sampleIndexRange: SampleIndexRange
		): ProfileInfo {
			const selectedSampleCount = sampleIndexRange.end - sampleIndexRange.start;
			const sampleStacks = getSampleStacks(profile);
			const sampleWeights = getSampleWeights(profile);
			const sampleCategories = getSampleCategories(profile);
			const total = computeTotalTypedArray(sampleWeights, sampleIndexRange);
			const categoryBreakdownTypedArray = categoryBreakdownThroughputAccumulator.measure(
				selectedSampleCount,
				() =>
					computeCategoryBreakdownWithPrecomputedSampleStacksTypedArray(
						profile,
						sampleCategories,
						sampleWeights,
						sampleIndexRange
					)
			);
			const categoryBreakdown = convertCategoryBreakdownTypedArrayToMap(
				profile,
				categoryBreakdownTypedArray
			);
			const heaviestStackIndex = heaviestStackThroughputAccumulator.measure(
				selectedSampleCount,
				() =>
					computeHeaviestStackIndexWithTypedArrays(
						profile.stackTable.length,
						sampleStacks,
						sampleWeights,
						sampleIndexRange
					)
			);
			const heaviestStack = convertStackIndexToStack(profile, heaviestStackIndex);
			return {
				overallSampleCount: profile.sampleTable.length,
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
