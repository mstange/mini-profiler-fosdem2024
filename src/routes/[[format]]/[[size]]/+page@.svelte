<script lang="ts">
	import { page } from '$app/stores';
	import type { PageData } from './$types';
	import ProfileUIWrapper from '$lib/components/ProfileUIWrapper.svelte';

	export let data: PageData;

	async function fetchProfileJson(size: string, format: string) {
		const profileJsonResponse = await fetch(`/profiles/${size}${format}.json.gz`);
		if (profileJsonResponse.status !== 200) {
			throw new Error(`Failed to fetch profile: ${profileJsonResponse.statusText}`);
		}
		return profileJsonResponse.json();
	}

	let v2impl = "basic";
	let v3impl = "basic";

	$: size = data.size;
	$: format = data.format;
	$: impl = { v1: "basic", v2: v2impl, v3: v3impl }[format] ?? "basic";
	$: profilePromise = fetchProfileJson(size, format);

</script>

<div class="wrapper">
	<aside>
		<section>
			<h2>Format V1: Nested objects</h2>
			<nav>
				<a href="/" class:active={$page.url.pathname == "/"}>Small</a>
				<del title="The JSON file would be 800MB big">Medium</del>
				<del title="The JSON file would be much bigger than a gigabyte">Large</del>
			</nav>
			<h3>Implementation</h3>
			<ul class="implementation">
				<li>
					<label><input type="radio" name="v1impl" value="basic" checked /> Basic</label>
				</li>
			</ul>
		</section>
		<section>
			<h2>Format V2: Multiple arrays of objects, with index references</h2>
			<nav>
				<a href="/v2" class:active={$page.url.pathname == "/v2"}>Small</a>
				<a href="/v2/medium" class:active={$page.url.pathname == "/v2/medium"}>Medium</a>
				<a href="/v2/large" class:active={$page.url.pathname == "/v2/large"}>Large</a>
			</nav>
			<h3>Implementation</h3>
			<ul class="implementation">
				<li>
					<label><input type="radio" name="v2impl" bind:group={v2impl} value="basic" checked /> Basic</label>
				</li>
				<li>
					<label
						><input type="radio" name="v2impl" bind:group={v2impl} value="categoryindexkey" /> Integer keys for category breakdown</label
					>
				</li>
				<li>
					<label
						><input type="radio" name="v2impl" bind:group={v2impl} value="typedarraymaps" /> Typed arrays instead of maps</label
					>
				</li>
			</ul>
		</section>
		<section>
			<h2>Format V3: Structs of arrays</h2>
			<nav>
				<a href="/v3" class:active={$page.url.pathname == "/v3"}>Small</a>
				<a href="/v3/medium" class:active={$page.url.pathname == "/v3/medium"}>Medium</a>
				<a href="/v3/large" class:active={$page.url.pathname == "/v3/large"}>Large</a>
			</nav>
			<h3>Implementation</h3>
			<ul class="implementation">
				<li>
					<label><input type="radio" name="v3impl" bind:group={v3impl} value="basic" checked /> Basic</label>
				</li>
				<li>
					<label
						><input type="radio" name="v3impl" bind:group={v3impl} value="memoizedsamplecategories" /> Memoized sample categories</label
					>
				</li>
				<li>
					<label
						><input type="radio" name="v3impl" bind:group={v3impl} value="memoizedtypedarrayinputs" /> Memoized typed array
						inputs</label
					>
				</li>
			</ul>
		</section>
	</aside>

	<main>
		{#await profilePromise}
			<p>Loading profile...</p>
		{:then profile}
			<ProfileUIWrapper profileAndFormat={{ format, profile, impl }} />
		{:catch error}
			<p>Couldn't fetch profile: {error.message}</p>
		{/await}
	</main>
</div>


<style>
	.wrapper {
		display: flex;
		flex-flow: row nowrap;
		font-family: system-ui, '-apple-system', BlinkMacSystemFont, 'Segoe UI', Roboto, Ubuntu, 'Helvetica Neue', sans-serif;
		font-size: 14px;
		line-height: 1.6;
	}

	aside {
		flex: 0 0 400px;
		margin-right: 30px;
	}

	h2, h3 {
		font-size: 1em;
	}

	section {
		margin: 10px;
		border: 1px solid #ccc;
		border-radius: 5px;
	}

	h2 {
		margin: 0;
		padding: 5px 10px;
		border-bottom: 1px solid #ccc;
	}

	nav {
		display: flex;
		flex-flow: row nowrap;
		border-bottom: 1px solid #ccc;
	}

	nav a, nav del {
		flex: 1;
		text-align: center;
		padding: 8px;
	}

	nav a.active {
		text-decoration: none;
		font-weight: bold;
		color: black;
	}

	nav a:hover, nav a.active {
		background: #f4f4f4;
	}

	h3 {
		margin: 10px;
	}

	.implementation {
		margin: 10px;
		list-style-type: none;
		padding: 0;
	}

</style>
