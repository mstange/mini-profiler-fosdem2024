export type CategoryBreakdown = Map<string, number>;
export type TimeRange = { start: number; end: number };
export type SampleIndexRange = { start: number; end: number };

export type ProfileInfo = {
	overallSampleCount: number;
	selectedSampleCount: number;
	total: number;
	categoryBreakdown: CategoryBreakdown;
	categoryBreakdownThroughput: number;
	heaviestStack: Stack;
	heaviestStackThroughput: number;
};

export type Stack = StackFrame[];
export type StackFrame = {
	name: string;
	category: string;
};
