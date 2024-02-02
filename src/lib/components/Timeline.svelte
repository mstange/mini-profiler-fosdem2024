<script lang="ts">
	import { createEventDispatcher, onMount } from 'svelte';
	import type { TimeRange } from '$lib/types';
	import clamp from 'clamp';

	export let baseRange: TimeRange;

	type PreviewSelection =
		| { hasSelection: false; isModifying: false }
		| {
				hasSelection: true;
				isModifying: boolean;
				selectionStart: number;
				selectionEnd: number;
		  };

	const dispatch = createEventDispatcher();

	let previewSelection: PreviewSelection = { hasSelection: false, isModifying: false };

	type MouseDownState = {
		mouseDownTime: number;
		rectLeft: number;
		rectWidth: number;
	};

	let mouseDownState: MouseDownState | null = null;

	const kMinSelectionStartWidth = 3;

	function handleMouseMove(_event: MouseEvent) {
		// const rect = (event.target as HTMLElement).getBoundingClientRect();
		// const x = event.clientX - rect.left;
		// const time = baseRange.start + (x / rect.width) * baseRange.duration;
		// mouseTimePosition = time;
	}

	function handleMouseDown(event: MouseEvent) {
		if (event.button !== 0 || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) {
			// Do not start a selection if the user doesn't press with the left button
			// or if they uses a keyboard modifier. Especially on MacOS ctrl+click can
			// be used to display the context menu.
			return;
		}

		event.preventDefault();
		event.stopPropagation();

		const rect = (event.target as HTMLElement).getBoundingClientRect();
		const { left: rectLeft, width: rectWidth } = rect;
		const mouseDownX = event.pageX;
		const mouseDownTime =
			((mouseDownX - rectLeft) / rectWidth) * (baseRange.end - baseRange.start) + baseRange.start;
		mouseDownState = {
			mouseDownTime,
			rectLeft,
			rectWidth
		};

		window.addEventListener('mousemove', handleWindowMouseMove);
		window.addEventListener('mouseup', handleWindowMouseUp);
	}

	function uninstallHandlers() {
		window.removeEventListener('mousemove', handleWindowMouseMove);
		window.removeEventListener('mouseup', handleWindowMouseUp);
	}

	function handleWindowMouseMove(event: MouseEvent) {
		const isLeftButtonUsed = (event.buttons & 1) > 0;
		if (!isLeftButtonUsed || mouseDownState === null) {
			// Oops, the mouseMove handler is still registered but the left button
			// isn't pressed, this means we missed the "click" event for some reason.
			// Maybe the user moved the cursor in some place where we didn't get the
			// click event because of Firefox issues such as bug 1755746 and bug 1755498.
			// Let's uninstall the event handlers and stop the selection.
			previewSelection = { ...previewSelection, isModifying: false };
			uninstallHandlers();
			return;
		}

		const { mouseDownTime, rectLeft, rectWidth } = mouseDownState;

		const mouseMoveX = event.clientX;
		const mouseMoveTime =
			((mouseMoveX - rectLeft) / rectWidth) * (baseRange.end - baseRange.start) + baseRange.start;
		const selectionStart = clamp(
			Math.min(mouseDownTime, mouseMoveTime),
			baseRange.start,
			baseRange.end
		);
		const selectionEnd = clamp(
			Math.max(mouseDownTime, mouseMoveTime),
			baseRange.start,
			baseRange.end
		);
		previewSelection = {
			hasSelection: true,
			isModifying: true,
			selectionStart,
			selectionEnd
		};
		dispatch('rangeupdate', { start: selectionStart, end: selectionEnd });
	}

	function handleWindowMouseUp(event: MouseEvent) {
		handleWindowMouseMove(event);
		previewSelection = { ...previewSelection, isModifying: false };
		uninstallHandlers();
	}

	onMount(() => {
		return () => {
			uninstallHandlers();
		};
	});
</script>

<div class="timeline" on:mousemove={handleMouseMove} on:mousedown={handleMouseDown} role="none">
	<slot />
	<div class="selectionOverlay">
		{#if previewSelection.hasSelection}
			<div
				class="selectionOverlayDarkening"
				style="left: 0; width: {((previewSelection.selectionStart - baseRange.start) /
					(baseRange.end - baseRange.start)) *
					100}%;"
			/>
			<div
				class="selectionOverlayDarkening"
				style="right: 0; left: {((previewSelection.selectionEnd - baseRange.start) /
					(baseRange.end - baseRange.start)) *
					100}%;"
			/>
		{/if}
	</div>
</div>

<style>
	.timeline {
		position: relative;
		width: 800px;
	}

	.selectionOverlay {
		position: absolute;
		inset: 0;
		pointer-events: none;
	}

	.selectionOverlayDarkening {
		position: absolute;
		top: 0;
		bottom: 0;
		background-color: rgba(0, 0, 0, 0.1);
	}
</style>
