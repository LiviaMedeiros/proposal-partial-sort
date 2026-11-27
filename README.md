# Partial Sort

Status: Stage 0

## The problem

In many applications, sorting frequently comes with selecting "Top K" elements when we don't really want *every* item of array being ordered, we just need a few items from the top. Sometimes just one.

In JavaScript, it's typically done in one of these:
```js
const topItemsFromLegacy = [...array].sort(compareFn).slice(0, k);
const topItemsFromModern = array.toSorted(compareFn).slice(0, k);
const topItemSingle = array.toSorted(compareFn)[0];
const [ itemFirst, itemSecond, itemThird ] = array.toSorted(compareFn);
```

Any of these approaches has an issue when `array.length ≫ k`: before taking the few elements, we have to perform full sort and allocate new array, even though most of items will be discarded right away. This comes with significant overhead in terms of both CPU time and memory consumption.

### Typical usecases

#### Leaderboards & ranking

Textbook example, rank and show top scores.

This pattern applies to game leaderboards, most active users, popular products, etc.

#### Analytics and reporting

Anything where we have a lot of data, define a metric and want to see "top few X that Y the most".

- Most frequent search queries
- Products with highest/lowest revenue
- Most common errors or warnings
- Most CPU-heavy or memory-heavy tasks
- Basically any other business-specific analytics

#### Search and recommendation systems

Searching systems often calculate relevance score and show top k items sorted by this score.

The selection is frequently shuffled to make it less irrigatingly obvious and spliced with promoted items but the basic way to get the selected set is usually partial sort.

#### Anything else where full sorting takes too much resources

Let's say, we are running out of space and want to find biggest files. There might be millions of files and we don't need more than 100, but sorting them will cause OOM.

## Solution

We can improve this from `O(n log n)` time and `O(n)` space complexity to `O(n log k)` time and `O(k)` memory by ignoring every `x > max(H)` element, where `H` is the set of element currently held.

## Proposed API

`Array.prototype.top(k, compareFn)`.

```js
const array = [ 5, 1, 4, 3, 6, 8, 2, 7, 9 ];
const topItemsFromFuture = array.top(3); // [ 1, 2, 3 ]
```

## Additional API

`Iterator.prototype.top(k, compareFn)`. Same but for `Iterator`.
`TypedArray.prototype.top(k, compareFn)`. Same but for `TypedArray`s.

## Prior art

- C++: `std::partial_sort_copy`
- Python: `heapq.nsmallest`
- Rust: `select_nth_unstable_by`
- D: `partialSort`
- Haskell: has this by design
- SQL: any decent engine does this for `ORDER BY ... LIMIT k`

## Name bikeshedding

- `top`
- `toPartialSorted`
- `toSortedSlice`
- `takeSmallest`
- etc.

## Alternative API

We could consider extending `Array.prototype.toSorted(compareFn)` into `Array.prototype.toSorted(compareFn, k)`.

This proposal prefers defining separate method, because:
- Adding new method is likely to be less breaking change than changing signature of already implemented method
- The internal implementation for partial sort should be different from regular sort, which will likely introduce incompatibility or surprising behaviour (especially if `compareFn` has side effects)
- We don't chanse inplace partial sort so it would be incompatible with `Array.prototype.sort`

## Polyfill

See [polyfill.mjs](./polyfill.mjs).

This polyfill is not production-ready, does not follow any formal spec, and will definitely have multiple breaking changes.

## Benchmark

See [benchmark.mjs](./benchmark.mjs).

The benchmark uses Node.js's builtin `node:bench` module. It compares polyfilled `Array.prototype.top()` impelementation against `.toSorted().slice()` and `iter-tools`'s `__takeSorted()`.

### Benchmark results

<details>
<summary>Raw results</summary>

```r
node: v28.0.0-pre (V8 15.8.62.61-node.4), linux x64 (Linux 7.3.6-gentoo-g7)
cpu: 24 x Intel(R) Xeon(R) CPU           X5675  @ 3.07GHz (available parallelism: 24)
memory: 47.2 GiB total, 46.2 GiB free
load average: 0.08, 0.02, 0.01
exec argv: --experimental-bench --bench

benchmark | samples | mean rate | 95% CI | median rate | warning
array > polyfill .top > n=10 k=10 | 30 | 120.58k ops/s | [115.01k ops/s, 126.15k ops/s] | 124.91k ops/s | noisy, skewed
array > iter-tools __takeSorted + toArray > n=10 k=10 | 30 | 23.51k ops/s | [21.45k ops/s, 25.58k ops/s] | 23.72k ops/s | noisy
array > toSorted + slice > n=10 k=10 | 30 | 309.59k ops/s | [305.07k ops/s, 314.11k ops/s] | 306.94k ops/s | skewed
iterable > polyfill .top > n=10 k=10 | 30 | 96.50k ops/s | [90.61k ops/s, 102.39k ops/s] | 97.67k ops/s | noisy, skewed
iterable > iter-tools __takeSorted + toArray > n=10 k=10 | 30 | 25.25k ops/s | [24.13k ops/s, 26.36k ops/s] | 26.78k ops/s | noisy, skewed
iterable > toArray + sort + slice > n=10 k=10 | 30 | 208.09k ops/s | [206.02k ops/s, 210.15k ops/s] | 207.77k ops/s |
array > polyfill .top > n=100 k=10 | 30 | 61.86k ops/s | [54.05k ops/s, 69.67k ops/s] | 74.26k ops/s | noisy, skewed
array > iter-tools __takeSorted + toArray > n=100 k=10 | 30 | 19.95k ops/s | [19.06k ops/s, 20.84k ops/s] | 20.94k ops/s | noisy, skewed
array > toSorted + slice > n=100 k=10 | 30 | 47.54k ops/s | [45.33k ops/s, 49.75k ops/s] | 49.22k ops/s | noisy, skewed
iterable > polyfill .top > n=100 k=10 | 30 | 32.68k ops/s | [30.65k ops/s, 34.70k ops/s] | 33.97k ops/s | noisy, skewed
iterable > iter-tools __takeSorted + toArray > n=100 k=10 | 30 | 16.22k ops/s | [14.72k ops/s, 17.72k ops/s] | 15.91k ops/s | noisy
iterable > toArray + sort + slice > n=100 k=10 | 30 | 36.00k ops/s | [35.67k ops/s, 36.34k ops/s] | 36.25k ops/s | skewed
array > polyfill .top > n=100 k=100 | 30 | 28.93k ops/s | [27.20k ops/s, 30.65k ops/s] | 31.32k ops/s | noisy, skewed
array > iter-tools __takeSorted + toArray > n=100 k=100 | 30 | 16.79k ops/s | [16.51k ops/s, 17.07k ops/s] | 17.00k ops/s | skewed
array > toSorted + slice > n=100 k=100 | 30 | 29.22k ops/s | [25.36k ops/s, 33.07k ops/s] | 25.55k ops/s | noisy
iterable > polyfill .top > n=100 k=100 | 30 | 26.66k ops/s | [24.74k ops/s, 28.57k ops/s] | 29.30k ops/s | noisy, skewed
iterable > iter-tools __takeSorted + toArray > n=100 k=100 | 30 | 15.63k ops/s | [14.87k ops/s, 16.39k ops/s] | 16.58k ops/s | noisy, skewed
iterable > toArray + sort + slice > n=100 k=100 | 30 | 34.59k ops/s | [33.33k ops/s, 35.86k ops/s] | 35.51k ops/s | noisy, skewed
array > polyfill .top > n=1000 k=10 | 30 | 11.69k ops/s | [10.92k ops/s, 12.46k ops/s] | 12.44k ops/s | noisy, skewed
array > iter-tools __takeSorted + toArray > n=1000 k=10 | 30 | 4.17k ops/s | [4.12k ops/s, 4.22k ops/s] | 4.23k ops/s |
array > toSorted + slice > n=1000 k=10 | 30 | 3.80k ops/s | [3.77k ops/s, 3.82k ops/s] | 3.82k ops/s | skewed
iterable > polyfill .top > n=1000 k=10 | 30 | 16.52k ops/s | [16.02k ops/s, 17.02k ops/s] | 17.01k ops/s | noisy, skewed
iterable > iter-tools __takeSorted + toArray > n=1000 k=10 | 30 | 3.48k ops/s | [3.28k ops/s, 3.69k ops/s] | 3.11k ops/s | noisy
iterable > toArray + sort + slice > n=1000 k=10 | 30 | 3.03k ops/s | [3.00k ops/s, 3.05k ops/s] | 3.06k ops/s | skewed
array > polyfill .top > n=1000 k=100 | 30 | 10.80k ops/s | [10.72k ops/s, 10.87k ops/s] | 10.81k ops/s |
array > iter-tools __takeSorted + toArray > n=1000 k=100 | 30 | 2.79k ops/s | [2.76k ops/s, 2.82k ops/s] | 2.82k ops/s | skewed
array > toSorted + slice > n=1000 k=100 | 30 | 2.34k ops/s | [2.05k ops/s, 2.63k ops/s] | 1.95k ops/s | noisy, skewed
iterable > polyfill .top > n=1000 k=100 | 30 | 8.73k ops/s | [8.66k ops/s, 8.81k ops/s] | 8.74k ops/s | skewed
iterable > iter-tools __takeSorted + toArray > n=1000 k=100 | 30 | 2.72k ops/s | [2.70k ops/s, 2.75k ops/s] | 2.75k ops/s | skewed
iterable > toArray + sort + slice > n=1000 k=100 | 30 | 3.03k ops/s | [3.01k ops/s, 3.05k ops/s] | 3.04k ops/s | skewed
array > polyfill .top > n=1000 k=1000 | 30 | 2.17k ops/s | [1.95k ops/s, 2.38k ops/s] | 1.86k ops/s | noisy
array > iter-tools __takeSorted + toArray > n=1000 k=1000 | 30 | 1.80k ops/s | [1.77k ops/s, 1.82k ops/s] | 1.82k ops/s | skewed
array > toSorted + slice > n=1000 k=1000 | 30 | 3.78k ops/s | [3.76k ops/s, 3.80k ops/s] | 3.81k ops/s |
iterable > polyfill .top > n=1000 k=1000 | 30 | 2.89k ops/s | [2.87k ops/s, 2.91k ops/s] | 2.89k ops/s | skewed
iterable > iter-tools __takeSorted + toArray > n=1000 k=1000 | 30 | 1.73k ops/s | [1.68k ops/s, 1.77k ops/s] | 1.78k ops/s | noisy, skewed
iterable > toArray + sort + slice > n=1000 k=1000 | 30 | 3.02k ops/s | [3.01k ops/s, 3.04k ops/s] | 3.02k ops/s |
array > polyfill .top > n=10000 k=10 | 30 | 2.73k ops/s | [2.45k ops/s, 3.02k ops/s] | 2.76k ops/s | noisy
array > iter-tools __takeSorted + toArray > n=10000 k=10 | 30 | 493.53 ops/s | [485.17 ops/s, 501.89 ops/s] | 507.93 ops/s |
array > toSorted + slice > n=10000 k=10 | 30 | 301.33 ops/s | [301.14 ops/s, 301.53 ops/s] | 301.48 ops/s | skewed
iterable > polyfill .top > n=10000 k=10 | 30 | 1.86k ops/s | [1.76k ops/s, 1.97k ops/s] | 1.95k ops/s | noisy, skewed
iterable > iter-tools __takeSorted + toArray > n=10000 k=10 | 30 | 449.87 ops/s | [446.95 ops/s, 452.78 ops/s] | 454.40 ops/s |
iterable > toArray + sort + slice > n=10000 k=10 | 30 | 250.54 ops/s | [249.79 ops/s, 251.29 ops/s] | 251.09 ops/s | skewed
array > polyfill .top > n=10000 k=100 | 30 | 2.63k ops/s | [2.62k ops/s, 2.65k ops/s] | 2.65k ops/s |
array > iter-tools __takeSorted + toArray > n=10000 k=100 | 30 | 327.39 ops/s | [323.41 ops/s, 331.37 ops/s] | 332.61 ops/s | skewed
array > toSorted + slice > n=10000 k=100 | 30 | 301.32 ops/s | [301.06 ops/s, 301.59 ops/s] | 301.45 ops/s | skewed
iterable > polyfill .top > n=10000 k=100 | 30 | 1.66k ops/s | [1.65k ops/s, 1.67k ops/s] | 1.66k ops/s | skewed
iterable > iter-tools __takeSorted + toArray > n=10000 k=100 | 30 | 309.13 ops/s | [308.82 ops/s, 309.44 ops/s] | 309.27 ops/s | skewed
iterable > toArray + sort + slice > n=10000 k=100 | 30 | 251.18 ops/s | [250.99 ops/s, 251.38 ops/s] | 251.21 ops/s |
array > polyfill .top > n=10000 k=1000 | 30 | 809.79 ops/s | [808.20 ops/s, 811.37 ops/s] | 810.04 ops/s |
array > iter-tools __takeSorted + toArray > n=10000 k=1000 | 30 | 235.29 ops/s | [235.00 ops/s, 235.57 ops/s] | 235.41 ops/s | skewed
array > toSorted + slice > n=10000 k=1000 | 30 | 300.47 ops/s | [300.33 ops/s, 300.61 ops/s] | 300.49 ops/s |
iterable > polyfill .top > n=10000 k=1000 | 30 | 721.60 ops/s | [707.22 ops/s, 735.99 ops/s] | 697.83 ops/s | noisy
iterable > iter-tools __takeSorted + toArray > n=10000 k=1000 | 30 | 252.07 ops/s | [251.74 ops/s, 252.40 ops/s] | 252.44 ops/s | skewed
iterable > toArray + sort + slice > n=10000 k=1000 | 30 | 282.34 ops/s | [281.94 ops/s, 282.75 ops/s] | 282.47 ops/s | skewed
array > polyfill .top > n=10000 k=10000 | 30 | 271.73 ops/s | [271.50 ops/s, 271.97 ops/s] | 271.90 ops/s |
array > iter-tools __takeSorted + toArray > n=10000 k=10000 | 30 | 177.58 ops/s | [177.29 ops/s, 177.87 ops/s] | 177.80 ops/s | skewed
array > toSorted + slice > n=10000 k=10000 | 30 | 337.94 ops/s | [337.48 ops/s, 338.40 ops/s] | 337.76 ops/s |
iterable > polyfill .top > n=10000 k=10000 | 30 | 261.36 ops/s | [261.03 ops/s, 261.69 ops/s] | 261.62 ops/s | skewed
iterable > iter-tools __takeSorted + toArray > n=10000 k=10000 | 30 | 172.89 ops/s | [172.77 ops/s, 173.01 ops/s] | 172.94 ops/s | skewed
iterable > toArray + sort + slice > n=10000 k=10000 | 30 | 281.44 ops/s | [281.18 ops/s, 281.70 ops/s] | 281.52 ops/s |
array > polyfill .top > n=100000 k=10 | 30 | 414.02 ops/s | [413.10 ops/s, 414.93 ops/s] | 414.64 ops/s |
array > iter-tools __takeSorted + toArray > n=100000 k=10 | 30 | 58.20 ops/s | [58.14 ops/s, 58.25 ops/s] | 58.17 ops/s |
array > toSorted + slice > n=100000 k=10 | 30 | 24.14 ops/s | [23.68 ops/s, 24.60 ops/s] | 24.73 ops/s | noisy
iterable > polyfill .top > n=100000 k=10 | 30 | 201.44 ops/s | [200.90 ops/s, 201.97 ops/s] | 201.54 ops/s | skewed
iterable > iter-tools __takeSorted + toArray > n=100000 k=10 | 30 | 45.76 ops/s | [45.69 ops/s, 45.84 ops/s] | 45.81 ops/s | skewed
iterable > toArray + sort + slice > n=100000 k=10 | 30 | 20.06 ops/s | [20.04 ops/s, 20.07 ops/s] | 20.07 ops/s | skewed
array > polyfill .top > n=100000 k=100 | 30 | 353.42 ops/s | [352.92 ops/s, 353.93 ops/s] | 353.28 ops/s |
array > iter-tools __takeSorted + toArray > n=100000 k=100 | 30 | 38.11 ops/s | [38.06 ops/s, 38.15 ops/s] | 38.13 ops/s | skewed
array > toSorted + slice > n=100000 k=100 | 30 | 23.90 ops/s | [23.44 ops/s, 24.35 ops/s] | 24.69 ops/s | noisy
iterable > polyfill .top > n=100000 k=100 | 30 | 197.19 ops/s | [197.02 ops/s, 197.36 ops/s] | 197.23 ops/s |
iterable > iter-tools __takeSorted + toArray > n=100000 k=100 | 30 | 31.22 ops/s | [31.15 ops/s, 31.28 ops/s] | 31.26 ops/s | skewed
iterable > toArray + sort + slice > n=100000 k=100 | 30 | 20.06 ops/s | [20.04 ops/s, 20.07 ops/s] | 20.07 ops/s | skewed
array > polyfill .top > n=100000 k=1000 | 30 | 223.45 ops/s | [223.06 ops/s, 223.84 ops/s] | 223.52 ops/s |
array > iter-tools __takeSorted + toArray > n=100000 k=1000 | 30 | 24.39 ops/s | [24.35 ops/s, 24.42 ops/s] | 24.40 ops/s | skewed
array > toSorted + slice > n=100000 k=1000 | 30 | 23.96 ops/s | [23.45 ops/s, 24.48 ops/s] | 25.05 ops/s | noisy
iterable > polyfill .top > n=100000 k=1000 | 30 | 149.49 ops/s | [148.60 ops/s, 150.38 ops/s] | 150.40 ops/s | skewed
iterable > iter-tools __takeSorted + toArray > n=100000 k=1000 | 30 | 23.03 ops/s | [23.00 ops/s, 23.05 ops/s] | 23.04 ops/s | skewed
iterable > toArray + sort + slice > n=100000 k=1000 | 30 | 22.34 ops/s | [22.23 ops/s, 22.46 ops/s] | 22.46 ops/s | skewed
array > polyfill .top > n=100000 k=10000 | 30 | 59.33 ops/s | [58.42 ops/s, 60.25 ops/s] | 60.64 ops/s | skewed
array > iter-tools __takeSorted + toArray > n=100000 k=10000 | 30 | 17.81 ops/s | [17.80 ops/s, 17.82 ops/s] | 17.82 ops/s |
array > toSorted + slice > n=100000 k=10000 | 30 | 22.34 ops/s | [22.30 ops/s, 22.39 ops/s] | 22.40 ops/s | skewed
iterable > polyfill .top > n=100000 k=10000 | 30 | 50.01 ops/s | [49.96 ops/s, 50.07 ops/s] | 50.05 ops/s |
iterable > iter-tools __takeSorted + toArray > n=100000 k=10000 | 30 | 17.15 ops/s | [17.15 ops/s, 17.15 ops/s] | 17.15 ops/s |
iterable > toArray + sort + slice > n=100000 k=10000 | 30 | 20.05 ops/s | [20.04 ops/s, 20.06 ops/s] | 20.06 ops/s |
array > polyfill .top > n=100000 k=100000 | 30 | 20.86 ops/s | [20.79 ops/s, 20.93 ops/s] | 20.91 ops/s | skewed
array > iter-tools __takeSorted + toArray > n=100000 k=100000 | 30 | 14.91 ops/s | [14.91 ops/s, 14.92 ops/s] | 14.92 ops/s | skewed
array > toSorted + slice > n=100000 k=100000 | 30 | 22.62 ops/s | [22.15 ops/s, 23.08 ops/s] | 22.34 ops/s | noisy
iterable > polyfill .top > n=100000 k=100000 | 30 | 18.21 ops/s | [18.15 ops/s, 18.27 ops/s] | 18.26 ops/s | skewed
iterable > iter-tools __takeSorted + toArray > n=100000 k=100000 | 30 | 13.38 ops/s | [13.12 ops/s, 13.64 ops/s] | 12.98 ops/s | noisy, skewed
iterable > toArray + sort + slice > n=100000 k=100000 | 30 | 19.86 ops/s | [19.75 ops/s, 19.97 ops/s] | 19.97 ops/s | skewed
array > polyfill .top > n=1000000 k=10 | 30 | 40.10 ops/s | [39.97 ops/s, 40.24 ops/s] | 40.00 ops/s |
array > iter-tools __takeSorted + toArray > n=1000000 k=10 | 30 | 5.73 ops/s | [5.70 ops/s, 5.76 ops/s] | 5.75 ops/s |
array > toSorted + slice > n=1000000 k=10 | 30 | 1.34 ops/s | [1.28 ops/s, 1.40 ops/s] | 1.28 ops/s | noisy
iterable > polyfill .top > n=1000000 k=10 | 30 | 20.01 ops/s | [20.00 ops/s, 20.02 ops/s] | 20.01 ops/s |
iterable > iter-tools __takeSorted + toArray > n=1000000 k=10 | 30 | 4.80 ops/s | [4.70 ops/s, 4.91 ops/s] | 4.58 ops/s | noisy
iterable > toArray + sort + slice > n=1000000 k=10 | 30 | 1.51 ops/s | [1.51 ops/s, 1.51 ops/s] | 1.51 ops/s |
array > polyfill .top > n=1000000 k=100 | 30 | 35.68 ops/s | [35.58 ops/s, 35.78 ops/s] | 35.59 ops/s |
array > iter-tools __takeSorted + toArray > n=1000000 k=100 | 30 | 3.77 ops/s | [3.76 ops/s, 3.78 ops/s] | 3.78 ops/s |
array > toSorted + slice > n=1000000 k=100 | 30 | 1.34 ops/s | [1.28 ops/s, 1.40 ops/s] | 1.27 ops/s | noisy
iterable > polyfill .top > n=1000000 k=100 | 30 | 19.93 ops/s | [19.91 ops/s, 19.95 ops/s] | 19.94 ops/s | skewed
iterable > iter-tools __takeSorted + toArray > n=1000000 k=100 | 30 | 3.51 ops/s | [3.51 ops/s, 3.51 ops/s] | 3.51 ops/s | skewed
iterable > toArray + sort + slice > n=1000000 k=100 | 30 | 1.51 ops/s | [1.51 ops/s, 1.51 ops/s] | 1.51 ops/s | skewed
array > polyfill .top > n=1000000 k=1000 | 30 | 32.40 ops/s | [32.31 ops/s, 32.48 ops/s] | 32.34 ops/s |
array > iter-tools __takeSorted + toArray > n=1000000 k=1000 | 30 | 2.70 ops/s | [2.66 ops/s, 2.74 ops/s] | 2.75 ops/s | skewed
array > toSorted + slice > n=1000000 k=1000 | 30 | 1.34 ops/s | [1.28 ops/s, 1.41 ops/s] | 1.27 ops/s | noisy
iterable > polyfill .top > n=1000000 k=1000 | 30 | 20.84 ops/s | [20.54 ops/s, 21.15 ops/s] | 21.12 ops/s | skewed
iterable > iter-tools __takeSorted + toArray > n=1000000 k=1000 | 30 | 2.58 ops/s | [2.56 ops/s, 2.61 ops/s] | 2.60 ops/s | skewed
iterable > toArray + sort + slice > n=1000000 k=1000 | 30 | 1.50 ops/s | [1.49 ops/s, 1.51 ops/s] | 1.51 ops/s | skewed
array > polyfill .top > n=1000000 k=10000 | 30 | 16.24 ops/s | [16.16 ops/s, 16.33 ops/s] | 16.27 ops/s |
array > iter-tools __takeSorted + toArray > n=1000000 k=10000 | 30 | 1.95 ops/s | [1.93 ops/s, 1.98 ops/s] | 1.98 ops/s | skewed
array > toSorted + slice > n=1000000 k=10000 | 30 | 1.34 ops/s | [1.28 ops/s, 1.40 ops/s] | 1.30 ops/s | noisy
iterable > polyfill .top > n=1000000 k=10000 | 30 | 12.24 ops/s | [12.18 ops/s, 12.30 ops/s] | 12.24 ops/s |
iterable > iter-tools __takeSorted + toArray > n=1000000 k=10000 | 30 | 1.83 ops/s | [1.79 ops/s, 1.87 ops/s] | 1.92 ops/s | noisy
iterable > toArray + sort + slice > n=1000000 k=10000 | 30 | 1.51 ops/s | [1.50 ops/s, 1.51 ops/s] | 1.51 ops/s |
array > polyfill .top > n=1000000 k=100000 | 30 | 2.84 ops/s | [2.82 ops/s, 2.85 ops/s] | 2.85 ops/s | skewed
array > iter-tools __takeSorted + toArray > n=1000000 k=100000 | 30 | 1.44 ops/s | [1.44 ops/s, 1.44 ops/s] | 1.44 ops/s |
array > toSorted + slice > n=1000000 k=100000 | 30 | 1.35 ops/s | [1.29 ops/s, 1.41 ops/s] | 1.32 ops/s | noisy
iterable > polyfill .top > n=1000000 k=100000 | 30 | 2.68 ops/s | [2.66 ops/s, 2.69 ops/s] | 2.68 ops/s | skewed
iterable > iter-tools __takeSorted + toArray > n=1000000 k=100000 | 30 | 1.46 ops/s | [1.44 ops/s, 1.49 ops/s] | 1.43 ops/s |
iterable > toArray + sort + slice > n=1000000 k=100000 | 30 | 1.47 ops/s | [1.46 ops/s, 1.48 ops/s] | 1.49 ops/s | skewed
array > polyfill .top > n=1000000 k=1000000 | 30 | 1.25 ops/s | [1.23 ops/s, 1.26 ops/s] | 1.26 ops/s | skewed
array > iter-tools __takeSorted + toArray > n=1000000 k=1000000 | 30 | 1.03 ops/s | [1.02 ops/s, 1.03 ops/s] | 1.03 ops/s |
array > toSorted + slice > n=1000000 k=1000000 | 30 | 1.19 ops/s | [1.17 ops/s, 1.21 ops/s] | 1.21 ops/s |
iterable > polyfill .top > n=1000000 k=1000000 | 30 | 1.31 ops/s | [1.30 ops/s, 1.33 ops/s] | 1.32 ops/s | skewed
iterable > iter-tools __takeSorted + toArray > n=1000000 k=1000000 | 30 | 1.01 ops/s | [1.01 ops/s, 1.01 ops/s] | 1.01 ops/s | skewed
iterable > toArray + sort + slice > n=1000000 k=1000000 | 30 | 1.44 ops/s | [1.44 ops/s, 1.45 ops/s] | 1.44 ops/s | skewed

126 completed, 0 failed, 0 skipped
```

</details>

- 🟢 means polyfill is faster than native sort
- 🔴 means polyfill is slower than native sort
- 🟡 means polyfill is slower than native sort but `n === k` so partial sort wasn't required

| Benchmark | Input | n | k | Mean rate | 95% CI | Median rate | Relative |
|---|---|---:|---:|---:|---|---:|---:|
| polyfill .top | array | 10 | 10 | 120.58k ops/s | [115.01k ops/s, 126.15k ops/s] | 124.91k ops/s | 🟡 1.00x (baseline) |
| iter-tools __takeSorted + toArray | array | 10 | 10 | 23.51k ops/s | [21.45k ops/s, 25.58k ops/s] | 23.72k ops/s | 5.13x slower |
| toSorted + slice | array | 10 | 10 | 309.59k ops/s | [305.07k ops/s, 314.11k ops/s] | 306.94k ops/s | 2.57x faster |
| polyfill .top | iterable | 10 | 10 | 96.50k ops/s | [90.61k ops/s, 102.39k ops/s] | 97.67k ops/s | 🟡 1.00x (baseline) |
| iter-tools __takeSorted + toArray | iterable | 10 | 10 | 25.25k ops/s | [24.13k ops/s, 26.36k ops/s] | 26.78k ops/s | 3.82x slower |
| toArray + sort + slice | iterable | 10 | 10 | 208.09k ops/s | [206.02k ops/s, 210.15k ops/s] | 207.77k ops/s | 2.16x faster |
| polyfill .top | array | 100 | 10 | 61.86k ops/s | [54.05k ops/s, 69.67k ops/s] | 74.26k ops/s | 🟢 1.00x (baseline) |
| iter-tools __takeSorted + toArray | array | 100 | 10 | 19.95k ops/s | [19.06k ops/s, 20.84k ops/s] | 20.94k ops/s | 3.10x slower |
| toSorted + slice | array | 100 | 10 | 47.54k ops/s | [45.33k ops/s, 49.75k ops/s] | 49.22k ops/s | 1.30x slower |
| polyfill .top | iterable | 100 | 10 | 32.68k ops/s | [30.65k ops/s, 34.70k ops/s] | 33.97k ops/s | 🔴 1.00x (baseline) |
| iter-tools __takeSorted + toArray | iterable | 100 | 10 | 16.22k ops/s | [14.72k ops/s, 17.72k ops/s] | 15.91k ops/s | 2.01x slower |
| toArray + sort + slice | iterable | 100 | 10 | 36.00k ops/s | [35.67k ops/s, 36.34k ops/s] | 36.25k ops/s | 1.10x faster |
| polyfill .top | array | 100 | 100 | 28.93k ops/s | [27.20k ops/s, 30.65k ops/s] | 31.32k ops/s | 🟡 1.00x (baseline) |
| iter-tools __takeSorted + toArray | array | 100 | 100 | 16.79k ops/s | [16.51k ops/s, 17.07k ops/s] | 17.00k ops/s | 1.72x slower |
| toSorted + slice | array | 100 | 100 | 29.22k ops/s | [25.36k ops/s, 33.07k ops/s] | 25.55k ops/s | 1.01x faster |
| polyfill .top | iterable | 100 | 100 | 26.66k ops/s | [24.74k ops/s, 28.57k ops/s] | 29.30k ops/s | 🟡 1.00x (baseline) |
| iter-tools __takeSorted + toArray | iterable | 100 | 100 | 15.63k ops/s | [14.87k ops/s, 16.39k ops/s] | 16.58k ops/s | 1.71x slower |
| toArray + sort + slice | iterable | 100 | 100 | 34.59k ops/s | [33.33k ops/s, 35.86k ops/s] | 35.51k ops/s | 1.30x faster |
| polyfill .top | array | 1000 | 10 | 11.69k ops/s | [10.92k ops/s, 12.46k ops/s] | 12.44k ops/s | 🟢 1.00x (baseline) |
| iter-tools __takeSorted + toArray | array | 1000 | 10 | 4.17k ops/s | [4.12k ops/s, 4.22k ops/s] | 4.23k ops/s | 2.80x slower |
| toSorted + slice | array | 1000 | 10 | 3.80k ops/s | [3.77k ops/s, 3.82k ops/s] | 3.82k ops/s | 3.08x slower |
| polyfill .top | iterable | 1000 | 10 | 16.52k ops/s | [16.02k ops/s, 17.02k ops/s] | 17.01k ops/s | 🟢 1.00x (baseline) |
| iter-tools __takeSorted + toArray | iterable | 1000 | 10 | 3.48k ops/s | [3.28k ops/s, 3.69k ops/s] | 3.11k ops/s | 4.75x slower |
| toArray + sort + slice | iterable | 1000 | 10 | 3.03k ops/s | [3.00k ops/s, 3.05k ops/s] | 3.06k ops/s | 5.45x slower |
| polyfill .top | array | 1000 | 100 | 10.80k ops/s | [10.72k ops/s, 10.87k ops/s] | 10.81k ops/s | 🟢 1.00x (baseline) |
| iter-tools __takeSorted + toArray | array | 1000 | 100 | 2.79k ops/s | [2.76k ops/s, 2.82k ops/s] | 2.82k ops/s | 3.87x slower |
| toSorted + slice | array | 1000 | 100 | 2.34k ops/s | [2.05k ops/s, 2.63k ops/s] | 1.95k ops/s | 4.62x slower |
| polyfill .top | iterable | 1000 | 100 | 8.73k ops/s | [8.66k ops/s, 8.81k ops/s] | 8.74k ops/s | 🟢 1.00x (baseline) |
| iter-tools __takeSorted + toArray | iterable | 1000 | 100 | 2.72k ops/s | [2.70k ops/s, 2.75k ops/s] | 2.75k ops/s | 3.21x slower |
| toArray + sort + slice | iterable | 1000 | 100 | 3.03k ops/s | [3.01k ops/s, 3.05k ops/s] | 3.04k ops/s | 2.88x slower |
| polyfill .top | array | 1000 | 1000 | 2.17k ops/s | [1.95k ops/s, 2.38k ops/s] | 1.86k ops/s | 🟡 1.00x (baseline) |
| iter-tools __takeSorted + toArray | array | 1000 | 1000 | 1.80k ops/s | [1.77k ops/s, 1.82k ops/s] | 1.82k ops/s | 1.21x slower |
| toSorted + slice | array | 1000 | 1000 | 3.78k ops/s | [3.76k ops/s, 3.80k ops/s] | 3.81k ops/s | 1.74x faster |
| polyfill .top | iterable | 1000 | 1000 | 2.89k ops/s | [2.87k ops/s, 2.91k ops/s] | 2.89k ops/s | 🟡 1.00x (baseline) |
| iter-tools __takeSorted + toArray | iterable | 1000 | 1000 | 1.73k ops/s | [1.68k ops/s, 1.77k ops/s] | 1.78k ops/s | 1.67x slower |
| toArray + sort + slice | iterable | 1000 | 1000 | 3.02k ops/s | [3.01k ops/s, 3.04k ops/s] | 3.02k ops/s | 1.04x faster |
| polyfill .top | array | 10000 | 10 | 2.73k ops/s | [2.45k ops/s, 3.02k ops/s] | 2.76k ops/s | 🟢 1.00x (baseline) |
| iter-tools __takeSorted + toArray | array | 10000 | 10 | 493.53 ops/s | [485.17 ops/s, 501.89 ops/s] | 507.93 ops/s | 5.53x slower |
| toSorted + slice | array | 10000 | 10 | 301.33 ops/s | [301.14 ops/s, 301.53 ops/s] | 301.48 ops/s | 9.06x slower |
| polyfill .top | iterable | 10000 | 10 | 1.86k ops/s | [1.76k ops/s, 1.97k ops/s] | 1.95k ops/s | 🟢 1.00x (baseline) |
| iter-tools __takeSorted + toArray | iterable | 10000 | 10 | 449.87 ops/s | [446.95 ops/s, 452.78 ops/s] | 454.40 ops/s | 4.13x slower |
| toArray + sort + slice | iterable | 10000 | 10 | 250.54 ops/s | [249.79 ops/s, 251.29 ops/s] | 251.09 ops/s | 7.42x slower |
| polyfill .top | array | 10000 | 100 | 2.63k ops/s | [2.62k ops/s, 2.65k ops/s] | 2.65k ops/s | 🟢 1.00x (baseline) |
| iter-tools __takeSorted + toArray | array | 10000 | 100 | 327.39 ops/s | [323.41 ops/s, 331.37 ops/s] | 332.61 ops/s | 8.03x slower |
| toSorted + slice | array | 10000 | 100 | 301.32 ops/s | [301.06 ops/s, 301.59 ops/s] | 301.45 ops/s | 8.73x slower |
| polyfill .top | iterable | 10000 | 100 | 1.66k ops/s | [1.65k ops/s, 1.67k ops/s] | 1.66k ops/s | 🟢 1.00x (baseline) |
| iter-tools __takeSorted + toArray | iterable | 10000 | 100 | 309.13 ops/s | [308.82 ops/s, 309.44 ops/s] | 309.27 ops/s | 5.37x slower |
| toArray + sort + slice | iterable | 10000 | 100 | 251.18 ops/s | [250.99 ops/s, 251.38 ops/s] | 251.21 ops/s | 6.61x slower |
| polyfill .top | array | 10000 | 1000 | 809.79 ops/s | [808.20 ops/s, 811.37 ops/s] | 810.04 ops/s | 🟢 1.00x (baseline) |
| iter-tools __takeSorted + toArray | array | 10000 | 1000 | 235.29 ops/s | [235.00 ops/s, 235.57 ops/s] | 235.41 ops/s | 3.44x slower |
| toSorted + slice | array | 10000 | 1000 | 300.47 ops/s | [300.33 ops/s, 300.61 ops/s] | 300.49 ops/s | 2.70x slower |
| polyfill .top | iterable | 10000 | 1000 | 721.60 ops/s | [707.22 ops/s, 735.99 ops/s] | 697.83 ops/s | 🟢 1.00x (baseline) |
| iter-tools __takeSorted + toArray | iterable | 10000 | 1000 | 252.07 ops/s | [251.74 ops/s, 252.40 ops/s] | 252.44 ops/s | 2.86x slower |
| toArray + sort + slice | iterable | 10000 | 1000 | 282.34 ops/s | [281.94 ops/s, 282.75 ops/s] | 282.47 ops/s | 2.56x slower |
| polyfill .top | array | 10000 | 10000 | 271.73 ops/s | [271.50 ops/s, 271.97 ops/s] | 271.90 ops/s | 🟡 1.00x (baseline) |
| iter-tools __takeSorted + toArray | array | 10000 | 10000 | 177.58 ops/s | [177.29 ops/s, 177.87 ops/s] | 177.80 ops/s | 1.53x slower |
| toSorted + slice | array | 10000 | 10000 | 337.94 ops/s | [337.48 ops/s, 338.40 ops/s] | 337.76 ops/s | 1.24x faster |
| polyfill .top | iterable | 10000 | 10000 | 261.36 ops/s | [261.03 ops/s, 261.69 ops/s] | 261.62 ops/s | 🟡 1.00x (baseline) |
| iter-tools __takeSorted + toArray | iterable | 10000 | 10000 | 172.89 ops/s | [172.77 ops/s, 173.01 ops/s] | 172.94 ops/s | 1.51x slower |
| toArray + sort + slice | iterable | 10000 | 10000 | 281.44 ops/s | [281.18 ops/s, 281.70 ops/s] | 281.52 ops/s | 1.08x faster |
| polyfill .top | array | 100000 | 10 | 414.02 ops/s | [413.10 ops/s, 414.93 ops/s] | 414.64 ops/s | 🟢 1.00x (baseline) |
| iter-tools __takeSorted + toArray | array | 100000 | 10 | 58.20 ops/s | [58.14 ops/s, 58.25 ops/s] | 58.17 ops/s | 7.11x slower |
| toSorted + slice | array | 100000 | 10 | 24.14 ops/s | [23.68 ops/s, 24.60 ops/s] | 24.73 ops/s | 17.15x slower |
| polyfill .top | iterable | 100000 | 10 | 201.44 ops/s | [200.90 ops/s, 201.97 ops/s] | 201.54 ops/s | 🟢 1.00x (baseline) |
| iter-tools __takeSorted + toArray | iterable | 100000 | 10 | 45.76 ops/s | [45.69 ops/s, 45.84 ops/s] | 45.81 ops/s | 4.40x slower |
| toArray + sort + slice | iterable | 100000 | 10 | 20.06 ops/s | [20.04 ops/s, 20.07 ops/s] | 20.07 ops/s | 10.04x slower |
| polyfill .top | array | 100000 | 100 | 353.42 ops/s | [352.92 ops/s, 353.93 ops/s] | 353.28 ops/s | 🟢 1.00x (baseline) |
| iter-tools __takeSorted + toArray | array | 100000 | 100 | 38.11 ops/s | [38.06 ops/s, 38.15 ops/s] | 38.13 ops/s | 9.27x slower |
| toSorted + slice | array | 100000 | 100 | 23.90 ops/s | [23.44 ops/s, 24.35 ops/s] | 24.69 ops/s | 14.79x slower |
| polyfill .top | iterable | 100000 | 100 | 197.19 ops/s | [197.02 ops/s, 197.36 ops/s] | 197.23 ops/s | 🟢 1.00x (baseline) |
| iter-tools __takeSorted + toArray | iterable | 100000 | 100 | 31.22 ops/s | [31.15 ops/s, 31.28 ops/s] | 31.26 ops/s | 6.32x slower |
| toArray + sort + slice | iterable | 100000 | 100 | 20.06 ops/s | [20.04 ops/s, 20.07 ops/s] | 20.07 ops/s | 9.83x slower |
| polyfill .top | array | 100000 | 1000 | 223.45 ops/s | [223.06 ops/s, 223.84 ops/s] | 223.52 ops/s | 🟢 1.00x (baseline) |
| iter-tools __takeSorted + toArray | array | 100000 | 1000 | 24.39 ops/s | [24.35 ops/s, 24.42 ops/s] | 24.40 ops/s | 9.16x slower |
| toSorted + slice | array | 100000 | 1000 | 23.96 ops/s | [23.45 ops/s, 24.48 ops/s] | 25.05 ops/s | 9.33x slower |
| polyfill .top | iterable | 100000 | 1000 | 149.49 ops/s | [148.60 ops/s, 150.38 ops/s] | 150.40 ops/s | 🟢 1.00x (baseline) |
| iter-tools __takeSorted + toArray | iterable | 100000 | 1000 | 23.03 ops/s | [23.00 ops/s, 23.05 ops/s] | 23.04 ops/s | 6.49x slower |
| toArray + sort + slice | iterable | 100000 | 1000 | 22.34 ops/s | [22.23 ops/s, 22.46 ops/s] | 22.46 ops/s | 6.69x slower |
| polyfill .top | array | 100000 | 10000 | 59.33 ops/s | [58.42 ops/s, 60.25 ops/s] | 60.64 ops/s | 🟢 1.00x (baseline) |
| iter-tools __takeSorted + toArray | array | 100000 | 10000 | 17.81 ops/s | [17.80 ops/s, 17.82 ops/s] | 17.82 ops/s | 3.33x slower |
| toSorted + slice | array | 100000 | 10000 | 22.34 ops/s | [22.30 ops/s, 22.39 ops/s] | 22.40 ops/s | 2.66x slower |
| polyfill .top | iterable | 100000 | 10000 | 50.01 ops/s | [49.96 ops/s, 50.07 ops/s] | 50.05 ops/s | 🟢 1.00x (baseline) |
| iter-tools __takeSorted + toArray | iterable | 100000 | 10000 | 17.15 ops/s | [17.15 ops/s, 17.15 ops/s] | 17.15 ops/s | 2.92x slower |
| toArray + sort + slice | iterable | 100000 | 10000 | 20.05 ops/s | [20.04 ops/s, 20.06 ops/s] | 20.06 ops/s | 2.49x slower |
| polyfill .top | array | 100000 | 100000 | 20.86 ops/s | [20.79 ops/s, 20.93 ops/s] | 20.91 ops/s | 🟡 1.00x (baseline) |
| iter-tools __takeSorted + toArray | array | 100000 | 100000 | 14.91 ops/s | [14.91 ops/s, 14.92 ops/s] | 14.92 ops/s | 1.40x slower |
| toSorted + slice | array | 100000 | 100000 | 22.62 ops/s | [22.15 ops/s, 23.08 ops/s] | 22.34 ops/s | 1.08x faster |
| polyfill .top | iterable | 100000 | 100000 | 18.21 ops/s | [18.15 ops/s, 18.27 ops/s] | 18.26 ops/s | 🟡 1.00x (baseline) |
| iter-tools __takeSorted + toArray | iterable | 100000 | 100000 | 13.38 ops/s | [13.12 ops/s, 13.64 ops/s] | 12.98 ops/s | 1.36x slower |
| toArray + sort + slice | iterable | 100000 | 100000 | 19.86 ops/s | [19.75 ops/s, 19.97 ops/s] | 19.97 ops/s | 1.09x faster |
| polyfill .top | array | 1000000 | 10 | 40.10 ops/s | [39.97 ops/s, 40.24 ops/s] | 40.00 ops/s | 🟡 1.00x (baseline) |
| iter-tools __takeSorted + toArray | array | 1000000 | 10 | 5.73 ops/s | [5.70 ops/s, 5.76 ops/s] | 5.75 ops/s | 7.00x slower |
| toSorted + slice | array | 1000000 | 10 | 1.34 ops/s | [1.28 ops/s, 1.40 ops/s] | 1.28 ops/s | 29.93x slower |
| polyfill .top | iterable | 1000000 | 10 | 20.01 ops/s | [20.00 ops/s, 20.02 ops/s] | 20.01 ops/s | 🟢 1.00x (baseline) |
| iter-tools __takeSorted + toArray | iterable | 1000000 | 10 | 4.80 ops/s | [4.70 ops/s, 4.91 ops/s] | 4.58 ops/s | 4.17x slower |
| toArray + sort + slice | iterable | 1000000 | 10 | 1.51 ops/s | [1.51 ops/s, 1.51 ops/s] | 1.51 ops/s | 13.25x slower |
| polyfill .top | array | 1000000 | 100 | 35.68 ops/s | [35.58 ops/s, 35.78 ops/s] | 35.59 ops/s | 🟢 1.00x (baseline) |
| iter-tools __takeSorted + toArray | array | 1000000 | 100 | 3.77 ops/s | [3.76 ops/s, 3.78 ops/s] | 3.78 ops/s | 9.46x slower |
| toSorted + slice | array | 1000000 | 100 | 1.34 ops/s | [1.28 ops/s, 1.40 ops/s] | 1.27 ops/s | 26.63x slower |
| polyfill .top | iterable | 1000000 | 100 | 19.93 ops/s | [19.91 ops/s, 19.95 ops/s] | 19.94 ops/s | 🟢 1.00x (baseline) |
| iter-tools __takeSorted + toArray | iterable | 1000000 | 100 | 3.51 ops/s | [3.51 ops/s, 3.51 ops/s] | 3.51 ops/s | 5.68x slower |
| toArray + sort + slice | iterable | 1000000 | 100 | 1.51 ops/s | [1.51 ops/s, 1.51 ops/s] | 1.51 ops/s | 13.20x slower |
| polyfill .top | array | 1000000 | 1000 | 32.40 ops/s | [32.31 ops/s, 32.48 ops/s] | 32.34 ops/s | 🟢 1.00x (baseline) |
| iter-tools __takeSorted + toArray | array | 1000000 | 1000 | 2.70 ops/s | [2.66 ops/s, 2.74 ops/s] | 2.75 ops/s | 12.00x slower |
| toSorted + slice | array | 1000000 | 1000 | 1.34 ops/s | [1.28 ops/s, 1.41 ops/s] | 1.27 ops/s | 24.18x slower |
| polyfill .top | iterable | 1000000 | 1000 | 20.84 ops/s | [20.54 ops/s, 21.15 ops/s] | 21.12 ops/s | 🟢 1.00x (baseline) |
| iter-tools __takeSorted + toArray | iterable | 1000000 | 1000 | 2.58 ops/s | [2.56 ops/s, 2.61 ops/s] | 2.60 ops/s | 8.08x slower |
| toArray + sort + slice | iterable | 1000000 | 1000 | 1.50 ops/s | [1.49 ops/s, 1.51 ops/s] | 1.51 ops/s | 13.89x slower |
| polyfill .top | array | 1000000 | 10000 | 16.24 ops/s | [16.16 ops/s, 16.33 ops/s] | 16.27 ops/s | 🟢 1.00x (baseline) |
| iter-tools __takeSorted + toArray | array | 1000000 | 10000 | 1.95 ops/s | [1.93 ops/s, 1.98 ops/s] | 1.98 ops/s | 8.33x slower |
| toSorted + slice | array | 1000000 | 10000 | 1.34 ops/s | [1.28 ops/s, 1.40 ops/s] | 1.30 ops/s | 12.12x slower |
| polyfill .top | iterable | 1000000 | 10000 | 12.24 ops/s | [12.18 ops/s, 12.30 ops/s] | 12.24 ops/s | 🟢 1.00x (baseline) |
| iter-tools __takeSorted + toArray | iterable | 1000000 | 10000 | 1.83 ops/s | [1.79 ops/s, 1.87 ops/s] | 1.92 ops/s | 6.69x slower |
| toArray + sort + slice | iterable | 1000000 | 10000 | 1.51 ops/s | [1.50 ops/s, 1.51 ops/s] | 1.51 ops/s | 8.11x slower |
| polyfill .top | array | 1000000 | 100000 | 2.84 ops/s | [2.82 ops/s, 2.85 ops/s] | 2.85 ops/s | 🟢 1.00x (baseline) |
| iter-tools __takeSorted + toArray | array | 1000000 | 100000 | 1.44 ops/s | [1.44 ops/s, 1.44 ops/s] | 1.44 ops/s | 1.97x slower |
| toSorted + slice | array | 1000000 | 100000 | 1.35 ops/s | [1.29 ops/s, 1.41 ops/s] | 1.32 ops/s | 2.10x slower |
| polyfill .top | iterable | 1000000 | 100000 | 2.68 ops/s | [2.66 ops/s, 2.69 ops/s] | 2.68 ops/s | 🟢 1.00x (baseline) |
| iter-tools __takeSorted + toArray | iterable | 1000000 | 100000 | 1.46 ops/s | [1.44 ops/s, 1.49 ops/s] | 1.43 ops/s | 1.84x slower |
| toArray + sort + slice | iterable | 1000000 | 100000 | 1.47 ops/s | [1.46 ops/s, 1.48 ops/s] | 1.49 ops/s | 1.82x slower |
| polyfill .top | array | 1000000 | 1000000 | 1.25 ops/s | [1.23 ops/s, 1.26 ops/s] | 1.26 ops/s | 🟢 1.00x (baseline) |
| iter-tools __takeSorted + toArray | array | 1000000 | 1000000 | 1.03 ops/s | [1.02 ops/s, 1.03 ops/s] | 1.03 ops/s | 1.21x slower |
| toSorted + slice | array | 1000000 | 1000000 | 1.19 ops/s | [1.17 ops/s, 1.21 ops/s] | 1.21 ops/s | 1.05x slower |
| polyfill .top | iterable | 1000000 | 1000000 | 1.31 ops/s | [1.30 ops/s, 1.33 ops/s] | 1.32 ops/s | 🟡 1.00x (baseline) |
| iter-tools __takeSorted + toArray | iterable | 1000000 | 1000000 | 1.01 ops/s | [1.01 ops/s, 1.01 ops/s] | 1.01 ops/s | 1.30x slower |
| toArray + sort + slice | iterable | 1000000 | 1000000 | 1.44 ops/s | [1.44 ops/s, 1.45 ops/s] | 1.44 ops/s | 1.10x faster |
