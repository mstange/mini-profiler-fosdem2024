import type { PageLoad } from './$types';

export const load: PageLoad = async ({ params }) => {
	const format = params.format || 'v1';
	const size = params.size || 'small';
	return {
		size,
		format
	};
};
