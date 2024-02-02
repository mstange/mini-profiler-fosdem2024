export class ThroughputAccumulator {
  // The last ten throughputs, in nanoseconds per item.
	_queue: number[] = [];

  // The sum of the last ten throughputs, in nanoseconds per item.
	_sum = 0;

	_add(value: number) {
		this._queue.push(value);
		this._sum += value;
		if (this._queue.length > 10) {
			this._sum -= this._queue.shift()!;
		}
	}

  // Returns the average of the last ten throughputs, in nanoseconds per item.
	get(): number {
		return this._sum / this._queue.length;
	}

  // Measures the time taken to execute a function, computes a throughput value, and adds it to the accumulator.
  // Returns the result of the function.
	measure<T>(count: number, fn: () => T): T {
		const start = performance.now();
		const result = fn();
		const end = performance.now();
		const duration = (end - start) * 1e6;
    if (count !== 0) {
      const throughput = duration / count;
      this._add(throughput);
    }
		return result;
	}
}

export function bisectionLeft(
	array: number[],
	x: number,
	lowArg?: number,
	highArg?: number
): number {
	let low = lowArg || 0;
	let high = highArg || array.length;

	if (low < 0 || low > array.length || high < 0 || high > array.length) {
		throw new TypeError("low and high must lie within the array's range");
	}

	while (low < high) {
		const mid = (low + high) >> 1;

		if (x <= array[mid]) {
			high = mid;
		} else {
			low = mid + 1;
		}
	}

	return low;
}

export function bisectionLeftByKey<T>(
	array: T[],
	f: (x: T) => number,
	x: number,
	lowArg?: number,
	highArg?: number
): number {
	let low = lowArg || 0;
	let high = highArg || array.length;

	if (low < 0 || low > array.length || high < 0 || high > array.length) {
		throw new TypeError("low and high must lie within the array's range");
	}

	while (low < high) {
		const mid = (low + high) >> 1;

		if (x <= f(array[mid])) {
			high = mid;
		} else {
			low = mid + 1;
		}
	}

	return low;
}
