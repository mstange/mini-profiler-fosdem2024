<script lang="ts">
	import ProfileUI from './ProfileUI.svelte';
	import { makeSelectorsV1 } from '$lib/v1';
	import { makeSelectorsV2Basic, makeSelectorsV2CategoryIndexKey, makeSelectorsV2TypedArrayMaps } from '$lib/v2';
	import { makeSelectorsV3Basic, makeSelectorsV3MemoizedSampleCategories, makeSelectorsV3MemoizedTypedArrayInputs } from '$lib/v3';

	export let profileAndFormat: {
		format: string;
		profile: any;
		impl: string;
	};

	function makeSelectorsForFormatAndImpl(format: string, impl: string) {
		switch (`${format}-${impl}`) {
			case 'v1-basic':
				return makeSelectorsV1();
			case 'v2-basic':
				return makeSelectorsV2Basic();
			case 'v2-categoryindexkey':
				return makeSelectorsV2CategoryIndexKey();
			case 'v2-typedarraymaps':
				return makeSelectorsV2TypedArrayMaps();
			case 'v3-basic':
				return makeSelectorsV3Basic();
			case 'v3-memoizedsamplecategories':
				return makeSelectorsV3MemoizedSampleCategories();
			case 'v3-memoizedtypedarrayinputs':
				return makeSelectorsV3MemoizedTypedArrayInputs();
			default:
				throw new Error(`Unknown format: ${format}`);
		}
	}

	$: selectors = makeSelectorsForFormatAndImpl(profileAndFormat.format, profileAndFormat.impl);

	$: baseRange = selectors.computeBaseRange(profileAndFormat.profile);
	$: graph = selectors.computeProfileGraph(profileAndFormat.profile);
	$: selectedRange = baseRange;
	$: sampleIndexRange = selectors.convertTimeRangeToSampleIndexRange(
		profileAndFormat.profile,
		selectedRange
	);
	$: info = selectors.getInfoForProfile(profileAndFormat.profile, sampleIndexRange);
</script>

<ProfileUI {...info} {baseRange} {graph} on:rangeupdate={(e) => (selectedRange = e.detail)} />
