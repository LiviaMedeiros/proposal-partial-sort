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
load average: 0.08, 0.03, 0.18
exec argv: --experimental-bench --bench

benchmark | samples | mean rate | 95% CI | median rate | warning
array > polyfill .top > n=10 k=1 | 30 | 225.66k ops/s | [222.20k ops/s, 229.13k ops/s] | 227.25k ops/s | skewed
array > iter-tools __takeSorted + toArray > n=10 k=1 | 30 | 30.73k ops/s | [29.11k ops/s, 32.36k ops/s] | 32.12k ops/s | noisy, skewed
array > toSorted + slice > n=10 k=1 | 30 | 304.43k ops/s | [299.69k ops/s, 309.18k ops/s] | 305.06k ops/s | skewed
iterable > polyfill .top > n=10 k=1 | 30 | 167.81k ops/s | [153.64k ops/s, 181.97k ops/s] | 166.52k ops/s | noisy, skewed
iterable > iter-tools __takeSorted + toArray > n=10 k=1 | 30 | 38.58k ops/s | [34.99k ops/s, 42.17k ops/s] | 43.31k ops/s | noisy, skewed
iterable > toArray + sort + slice > n=10 k=1 | 30 | 204.50k ops/s | [192.85k ops/s, 216.15k ops/s] | 209.97k ops/s | noisy, skewed
array > polyfill .top > n=10 k=10 | 30 | 125.21k ops/s | [118.47k ops/s, 131.94k ops/s] | 128.61k ops/s | noisy, skewed
array > iter-tools __takeSorted + toArray > n=10 k=10 | 30 | 30.88k ops/s | [28.66k ops/s, 33.10k ops/s] | 32.85k ops/s | noisy, skewed
array > toSorted + slice > n=10 k=10 | 30 | 238.59k ops/s | [231.14k ops/s, 246.04k ops/s] | 244.20k ops/s | noisy, skewed
iterable > polyfill .top > n=10 k=10 | 30 | 153.90k ops/s | [135.27k ops/s, 172.53k ops/s] | 144.51k ops/s | noisy
iterable > iter-tools __takeSorted + toArray > n=10 k=10 | 30 | 35.86k ops/s | [32.76k ops/s, 38.96k ops/s] | 33.92k ops/s | noisy
iterable > toArray + sort + slice > n=10 k=10 | 30 | 212.25k ops/s | [203.70k ops/s, 220.81k ops/s] | 212.86k ops/s | noisy
array > polyfill .top > n=100 k=1 | 30 | 179.60k ops/s | [171.73k ops/s, 187.46k ops/s] | 185.15k ops/s | noisy, skewed
array > iter-tools __takeSorted + toArray > n=100 k=1 | 30 | 22.17k ops/s | [21.70k ops/s, 22.64k ops/s] | 22.51k ops/s | noisy, skewed
array > toSorted + slice > n=100 k=1 | 30 | 47.70k ops/s | [46.48k ops/s, 48.93k ops/s] | 48.72k ops/s | noisy, skewed
iterable > polyfill .top > n=100 k=1 | 30 | 121.66k ops/s | [117.39k ops/s, 125.94k ops/s] | 123.93k ops/s | noisy, skewed
iterable > iter-tools __takeSorted + toArray > n=100 k=1 | 30 | 28.80k ops/s | [28.27k ops/s, 29.32k ops/s] | 29.13k ops/s | skewed
iterable > toArray + sort + slice > n=100 k=1 | 30 | 35.89k ops/s | [35.56k ops/s, 36.21k ops/s] | 35.83k ops/s | skewed
array > polyfill .top > n=100 k=10 | 30 | 36.02k ops/s | [31.78k ops/s, 40.26k ops/s] | 41.20k ops/s | noisy, skewed
array > iter-tools __takeSorted + toArray > n=100 k=10 | 30 | 19.90k ops/s | [18.93k ops/s, 20.86k ops/s] | 20.64k ops/s | noisy, skewed
array > toSorted + slice > n=100 k=10 | 30 | 48.53k ops/s | [48.18k ops/s, 48.88k ops/s] | 48.89k ops/s | skewed
iterable > polyfill .top > n=100 k=10 | 30 | 52.42k ops/s | [46.68k ops/s, 58.16k ops/s] | 62.10k ops/s | noisy
iterable > iter-tools __takeSorted + toArray > n=100 k=10 | 30 | 23.11k ops/s | [22.20k ops/s, 24.02k ops/s] | 23.69k ops/s | noisy, skewed
iterable > toArray + sort + slice > n=100 k=10 | 30 | 20.71k ops/s | [18.76k ops/s, 22.65k ops/s] | 22.57k ops/s | noisy, skewed
array > polyfill .top > n=100 k=100 | 30 | 23.04k ops/s | [20.71k ops/s, 25.37k ops/s] | 18.86k ops/s | noisy
array > iter-tools __takeSorted + toArray > n=100 k=100 | 30 | 16.55k ops/s | [15.88k ops/s, 17.22k ops/s] | 17.49k ops/s | noisy, skewed
array > toSorted + slice > n=100 k=100 | 30 | 48.35k ops/s | [47.94k ops/s, 48.76k ops/s] | 48.30k ops/s | skewed
iterable > polyfill .top > n=100 k=100 | 30 | 29.87k ops/s | [29.64k ops/s, 30.10k ops/s] | 29.89k ops/s |
iterable > iter-tools __takeSorted + toArray > n=100 k=100 | 30 | 12.25k ops/s | [11.62k ops/s, 12.87k ops/s] | 12.73k ops/s | noisy, skewed
iterable > toArray + sort + slice > n=100 k=100 | 30 | 34.18k ops/s | [32.43k ops/s, 35.93k ops/s] | 35.77k ops/s | noisy, skewed
array > polyfill .top > n=1000 k=1 | 30 | 25.19k ops/s | [24.55k ops/s, 25.84k ops/s] | 25.84k ops/s | noisy, skewed
array > iter-tools __takeSorted + toArray > n=1000 k=1 | 30 | 6.23k ops/s | [6.12k ops/s, 6.35k ops/s] | 6.32k ops/s | skewed
array > toSorted + slice > n=1000 k=1 | 30 | 2.33k ops/s | [2.01k ops/s, 2.65k ops/s] | 1.96k ops/s | noisy
iterable > polyfill .top > n=1000 k=1 | 30 | 18.52k ops/s | [18.17k ops/s, 18.87k ops/s] | 18.83k ops/s | noisy, skewed
iterable > iter-tools __takeSorted + toArray > n=1000 k=1 | 30 | 2.74k ops/s | [2.51k ops/s, 2.97k ops/s] | 2.62k ops/s | noisy, skewed
iterable > toArray + sort + slice > n=1000 k=1 | 30 | 3.03k ops/s | [3.01k ops/s, 3.05k ops/s] | 3.05k ops/s | skewed
array > polyfill .top > n=1000 k=10 | 30 | 26.86k ops/s | [26.43k ops/s, 27.29k ops/s] | 27.30k ops/s | skewed
array > iter-tools __takeSorted + toArray > n=1000 k=10 | 30 | 3.07k ops/s | [3.02k ops/s, 3.13k ops/s] | 3.12k ops/s | skewed
array > toSorted + slice > n=1000 k=10 | 30 | 3.72k ops/s | [3.69k ops/s, 3.75k ops/s] | 3.71k ops/s |
iterable > polyfill .top > n=1000 k=10 | 30 | 16.75k ops/s | [16.56k ops/s, 16.93k ops/s] | 16.92k ops/s | skewed
iterable > iter-tools __takeSorted + toArray > n=1000 k=10 | 30 | 3.98k ops/s | [3.91k ops/s, 4.05k ops/s] | 4.07k ops/s | skewed
iterable > toArray + sort + slice > n=1000 k=10 | 30 | 2.45k ops/s | [2.23k ops/s, 2.67k ops/s] | 2.38k ops/s | noisy
array > polyfill .top > n=1000 k=100 | 30 | 4.43k ops/s | [4.26k ops/s, 4.59k ops/s] | 4.55k ops/s | noisy, skewed
array > iter-tools __takeSorted + toArray > n=1000 k=100 | 30 | 2.78k ops/s | [2.72k ops/s, 2.84k ops/s] | 2.83k ops/s | noisy, skewed
array > toSorted + slice > n=1000 k=100 | 30 | 3.79k ops/s | [3.77k ops/s, 3.81k ops/s] | 3.82k ops/s |
iterable > polyfill .top > n=1000 k=100 | 30 | 8.61k ops/s | [8.51k ops/s, 8.70k ops/s] | 8.63k ops/s |
iterable > iter-tools __takeSorted + toArray > n=1000 k=100 | 30 | 2.06k ops/s | [1.89k ops/s, 2.24k ops/s] | 1.87k ops/s | noisy
iterable > toArray + sort + slice > n=1000 k=100 | 30 | 2.17k ops/s | [1.96k ops/s, 2.37k ops/s] | 1.89k ops/s | noisy
array > polyfill .top > n=1000 k=1000 | 30 | 3.09k ops/s | [3.07k ops/s, 3.10k ops/s] | 3.10k ops/s | skewed
array > iter-tools __takeSorted + toArray > n=1000 k=1000 | 30 | 1.59k ops/s | [1.52k ops/s, 1.66k ops/s] | 1.47k ops/s | noisy
array > toSorted + slice > n=1000 k=1000 | 30 | 3.78k ops/s | [3.76k ops/s, 3.80k ops/s] | 3.80k ops/s |
iterable > polyfill .top > n=1000 k=1000 | 30 | 2.45k ops/s | [2.25k ops/s, 2.65k ops/s] | 2.82k ops/s | noisy
iterable > iter-tools __takeSorted + toArray > n=1000 k=1000 | 30 | 1.79k ops/s | [1.77k ops/s, 1.81k ops/s] | 1.80k ops/s | skewed
iterable > toArray + sort + slice > n=1000 k=1000 | 30 | 2.20k ops/s | [2.00k ops/s, 2.40k ops/s] | 1.88k ops/s | noisy
array > polyfill .top > n=10000 k=1 | 30 | 2.85k ops/s | [2.58k ops/s, 3.11k ops/s] | 3.29k ops/s | noisy
array > iter-tools __takeSorted + toArray > n=10000 k=1 | 30 | 761.98 ops/s | [728.45 ops/s, 795.51 ops/s] | 803.66 ops/s | noisy, skewed
array > toSorted + slice > n=10000 k=1 | 30 | 301.53 ops/s | [301.34 ops/s, 301.72 ops/s] | 301.74 ops/s |
iterable > polyfill .top > n=10000 k=1 | 30 | 1.93k ops/s | [1.91k ops/s, 1.95k ops/s] | 1.94k ops/s | skewed
iterable > iter-tools __takeSorted + toArray > n=10000 k=1 | 30 | 661.21 ops/s | [650.83 ops/s, 671.58 ops/s] | 673.17 ops/s | skewed
iterable > toArray + sort + slice > n=10000 k=1 | 30 | 251.40 ops/s | [251.21 ops/s, 251.59 ops/s] | 251.41 ops/s |
array > polyfill .top > n=10000 k=10 | 30 | 3.49k ops/s | [3.45k ops/s, 3.52k ops/s] | 3.53k ops/s | skewed
array > iter-tools __takeSorted + toArray > n=10000 k=10 | 30 | 509.55 ops/s | [507.59 ops/s, 511.51 ops/s] | 511.27 ops/s | skewed
array > toSorted + slice > n=10000 k=10 | 30 | 301.25 ops/s | [301.01 ops/s, 301.49 ops/s] | 301.42 ops/s | skewed
iterable > polyfill .top > n=10000 k=10 | 30 | 1.92k ops/s | [1.91k ops/s, 1.93k ops/s] | 1.91k ops/s |
iterable > iter-tools __takeSorted + toArray > n=10000 k=10 | 30 | 454.69 ops/s | [454.40 ops/s, 454.98 ops/s] | 455.01 ops/s | skewed
iterable > toArray + sort + slice > n=10000 k=10 | 30 | 251.15 ops/s | [250.95 ops/s, 251.36 ops/s] | 251.19 ops/s | skewed
array > polyfill .top > n=10000 k=100 | 30 | 2.64k ops/s | [2.62k ops/s, 2.65k ops/s] | 2.64k ops/s |
array > iter-tools __takeSorted + toArray > n=10000 k=100 | 30 | 333.81 ops/s | [333.54 ops/s, 334.07 ops/s] | 333.91 ops/s |
array > toSorted + slice > n=10000 k=100 | 30 | 301.28 ops/s | [301.12 ops/s, 301.45 ops/s] | 301.29 ops/s |
iterable > polyfill .top > n=10000 k=100 | 30 | 1.64k ops/s | [1.63k ops/s, 1.65k ops/s] | 1.64k ops/s |
iterable > iter-tools __takeSorted + toArray > n=10000 k=100 | 30 | 348.28 ops/s | [347.61 ops/s, 348.96 ops/s] | 348.89 ops/s | skewed
iterable > toArray + sort + slice > n=10000 k=100 | 30 | 282.65 ops/s | [282.16 ops/s, 283.15 ops/s] | 282.89 ops/s | skewed
array > polyfill .top > n=10000 k=1000 | 30 | 899.00 ops/s | [896.08 ops/s, 901.92 ops/s] | 899.56 ops/s | skewed
array > iter-tools __takeSorted + toArray > n=10000 k=1000 | 30 | 266.31 ops/s | [266.10 ops/s, 266.53 ops/s] | 266.44 ops/s | skewed
array > toSorted + slice > n=10000 k=1000 | 30 | 339.50 ops/s | [339.16 ops/s, 339.83 ops/s] | 339.66 ops/s |
iterable > polyfill .top > n=10000 k=1000 | 30 | 766.87 ops/s | [762.99 ops/s, 770.75 ops/s] | 770.32 ops/s | skewed
iterable > iter-tools __takeSorted + toArray > n=10000 k=1000 | 30 | 252.16 ops/s | [251.67 ops/s, 252.66 ops/s] | 252.66 ops/s | skewed
iterable > toArray + sort + slice > n=10000 k=1000 | 30 | 282.30 ops/s | [281.81 ops/s, 282.79 ops/s] | 282.58 ops/s | skewed
array > polyfill .top > n=10000 k=10000 | 30 | 271.77 ops/s | [271.38 ops/s, 272.17 ops/s] | 271.92 ops/s | skewed
array > iter-tools __takeSorted + toArray > n=10000 k=10000 | 30 | 178.44 ops/s | [178.20 ops/s, 178.68 ops/s] | 178.63 ops/s | skewed
array > toSorted + slice > n=10000 k=10000 | 30 | 337.92 ops/s | [337.38 ops/s, 338.45 ops/s] | 337.78 ops/s | skewed
iterable > polyfill .top > n=10000 k=10000 | 30 | 261.00 ops/s | [260.69 ops/s, 261.30 ops/s] | 261.26 ops/s | skewed
iterable > iter-tools __takeSorted + toArray > n=10000 k=10000 | 30 | 174.02 ops/s | [173.94 ops/s, 174.09 ops/s] | 174.02 ops/s |
iterable > toArray + sort + slice > n=10000 k=10000 | 30 | 282.28 ops/s | [282.01 ops/s, 282.54 ops/s] | 282.43 ops/s | skewed
array > polyfill .top > n=100000 k=1 | 30 | 414.23 ops/s | [412.80 ops/s, 415.65 ops/s] | 415.13 ops/s |
array > iter-tools __takeSorted + toArray > n=100000 k=1 | 30 | 81.82 ops/s | [81.67 ops/s, 81.97 ops/s] | 81.87 ops/s | skewed
array > toSorted + slice > n=100000 k=1 | 30 | 22.38 ops/s | [22.09 ops/s, 22.68 ops/s] | 22.40 ops/s |
iterable > polyfill .top > n=100000 k=1 | 30 | 198.27 ops/s | [198.03 ops/s, 198.50 ops/s] | 198.36 ops/s |
iterable > iter-tools __takeSorted + toArray > n=100000 k=1 | 30 | 68.53 ops/s | [68.43 ops/s, 68.62 ops/s] | 68.52 ops/s |
iterable > toArray + sort + slice > n=100000 k=1 | 30 | 20.04 ops/s | [20.03 ops/s, 20.05 ops/s] | 20.05 ops/s |
array > polyfill .top > n=100000 k=10 | 30 | 398.92 ops/s | [391.24 ops/s, 406.61 ops/s] | 412.15 ops/s | noisy
array > iter-tools __takeSorted + toArray > n=100000 k=10 | 30 | 58.14 ops/s | [57.92 ops/s, 58.36 ops/s] | 58.21 ops/s | skewed
array > toSorted + slice > n=100000 k=10 | 30 | 22.30 ops/s | [22.10 ops/s, 22.49 ops/s] | 22.40 ops/s | skewed
iterable > polyfill .top > n=100000 k=10 | 30 | 198.50 ops/s | [198.27 ops/s, 198.72 ops/s] | 198.54 ops/s |
iterable > iter-tools __takeSorted + toArray > n=100000 k=10 | 30 | 45.85 ops/s | [45.80 ops/s, 45.89 ops/s] | 45.86 ops/s | skewed
iterable > toArray + sort + slice > n=100000 k=10 | 30 | 21.38 ops/s | [20.92 ops/s, 21.83 ops/s] | 22.43 ops/s | noisy
array > polyfill .top > n=100000 k=100 | 30 | 394.65 ops/s | [393.58 ops/s, 395.72 ops/s] | 395.18 ops/s | skewed
array > iter-tools __takeSorted + toArray > n=100000 k=100 | 30 | 38.11 ops/s | [38.07 ops/s, 38.15 ops/s] | 38.14 ops/s | skewed
array > toSorted + slice > n=100000 k=100 | 30 | 24.93 ops/s | [24.71 ops/s, 25.15 ops/s] | 25.05 ops/s | skewed
iterable > polyfill .top > n=100000 k=100 | 30 | 193.66 ops/s | [193.36 ops/s, 193.97 ops/s] | 193.93 ops/s | skewed
iterable > iter-tools __takeSorted + toArray > n=100000 k=100 | 30 | 31.28 ops/s | [31.27 ops/s, 31.29 ops/s] | 31.28 ops/s | skewed
iterable > toArray + sort + slice > n=100000 k=100 | 30 | 21.92 ops/s | [21.53 ops/s, 22.31 ops/s] | 22.48 ops/s | skewed
array > polyfill .top > n=100000 k=1000 | 30 | 247.47 ops/s | [246.75 ops/s, 248.19 ops/s] | 247.79 ops/s | skewed
array > iter-tools __takeSorted + toArray > n=100000 k=1000 | 30 | 27.51 ops/s | [27.49 ops/s, 27.53 ops/s] | 27.53 ops/s | skewed
array > toSorted + slice > n=100000 k=1000 | 30 | 24.25 ops/s | [23.77 ops/s, 24.72 ops/s] | 25.03 ops/s | noisy
iterable > polyfill .top > n=100000 k=1000 | 30 | 148.46 ops/s | [148.26 ops/s, 148.66 ops/s] | 148.49 ops/s | skewed
iterable > iter-tools __takeSorted + toArray > n=100000 k=1000 | 30 | 23.00 ops/s | [22.98 ops/s, 23.02 ops/s] | 23.02 ops/s | skewed
iterable > toArray + sort + slice > n=100000 k=1000 | 30 | 20.98 ops/s | [20.53 ops/s, 21.42 ops/s] | 20.07 ops/s | noisy
array > polyfill .top > n=100000 k=10000 | 30 | 56.49 ops/s | [55.59 ops/s, 57.39 ops/s] | 55.26 ops/s | skewed
array > iter-tools __takeSorted + toArray > n=100000 k=10000 | 30 | 17.77 ops/s | [17.66 ops/s, 17.89 ops/s] | 17.69 ops/s | skewed
array > toSorted + slice > n=100000 k=10000 | 30 | 25.06 ops/s | [25.04 ops/s, 25.07 ops/s] | 25.06 ops/s |
iterable > polyfill .top > n=100000 k=10000 | 30 | 49.63 ops/s | [49.54 ops/s, 49.72 ops/s] | 49.72 ops/s | skewed
iterable > iter-tools __takeSorted + toArray > n=100000 k=10000 | 30 | 17.16 ops/s | [17.15 ops/s, 17.16 ops/s] | 17.16 ops/s | skewed
iterable > toArray + sort + slice > n=100000 k=10000 | 30 | 22.45 ops/s | [22.44 ops/s, 22.47 ops/s] | 22.46 ops/s |
array > polyfill .top > n=100000 k=100000 | 30 | 20.93 ops/s | [20.92 ops/s, 20.94 ops/s] | 20.92 ops/s |
array > iter-tools __takeSorted + toArray > n=100000 k=100000 | 30 | 13.86 ops/s | [13.57 ops/s, 14.16 ops/s] | 13.28 ops/s | noisy
array > toSorted + slice > n=100000 k=100000 | 30 | 22.62 ops/s | [22.16 ops/s, 23.09 ops/s] | 22.33 ops/s | noisy
iterable > polyfill .top > n=100000 k=100000 | 30 | 18.15 ops/s | [18.08 ops/s, 18.21 ops/s] | 18.20 ops/s | skewed
iterable > iter-tools __takeSorted + toArray > n=100000 k=100000 | 30 | 13.38 ops/s | [13.12 ops/s, 13.64 ops/s] | 12.99 ops/s | noisy, skewed
iterable > toArray + sort + slice > n=100000 k=100000 | 30 | 19.99 ops/s | [19.98 ops/s, 19.99 ops/s] | 19.99 ops/s |
array > polyfill .top > n=1000000 k=1 | 30 | 40.19 ops/s | [40.06 ops/s, 40.32 ops/s] | 40.02 ops/s |
array > iter-tools __takeSorted + toArray > n=1000000 k=1 | 30 | 9.04 ops/s | [8.98 ops/s, 9.10 ops/s] | 9.11 ops/s |
array > toSorted + slice > n=1000000 k=1 | 30 | 1.34 ops/s | [1.28 ops/s, 1.41 ops/s] | 1.27 ops/s | noisy
iterable > polyfill .top > n=1000000 k=1 | 30 | 19.61 ops/s | [19.55 ops/s, 19.67 ops/s] | 19.67 ops/s | skewed
iterable > iter-tools __takeSorted + toArray > n=1000000 k=1 | 30 | 7.76 ops/s | [7.75 ops/s, 7.77 ops/s] | 7.76 ops/s | skewed
iterable > toArray + sort + slice > n=1000000 k=1 | 30 | 1.51 ops/s | [1.51 ops/s, 1.51 ops/s] | 1.52 ops/s | skewed
array > polyfill .top > n=1000000 k=10 | 30 | 35.99 ops/s | [35.88 ops/s, 36.10 ops/s] | 35.87 ops/s |
array > iter-tools __takeSorted + toArray > n=1000000 k=10 | 30 | 5.68 ops/s | [5.60 ops/s, 5.76 ops/s] | 5.76 ops/s | skewed
array > toSorted + slice > n=1000000 k=10 | 30 | 1.35 ops/s | [1.28 ops/s, 1.41 ops/s] | 1.27 ops/s | noisy
iterable > polyfill .top > n=1000000 k=10 | 30 | 19.63 ops/s | [19.60 ops/s, 19.65 ops/s] | 19.65 ops/s | skewed
iterable > iter-tools __takeSorted + toArray > n=1000000 k=10 | 30 | 4.98 ops/s | [4.88 ops/s, 5.08 ops/s] | 5.16 ops/s | noisy
iterable > toArray + sort + slice > n=1000000 k=10 | 30 | 1.51 ops/s | [1.50 ops/s, 1.51 ops/s] | 1.51 ops/s | skewed
array > polyfill .top > n=1000000 k=100 | 30 | 35.64 ops/s | [35.53 ops/s, 35.75 ops/s] | 35.54 ops/s |
array > iter-tools __takeSorted + toArray > n=1000000 k=100 | 30 | 3.68 ops/s | [3.61 ops/s, 3.75 ops/s] | 3.78 ops/s | skewed
array > toSorted + slice > n=1000000 k=100 | 30 | 1.35 ops/s | [1.29 ops/s, 1.42 ops/s] | 1.35 ops/s | noisy
iterable > polyfill .top > n=1000000 k=100 | 30 | 19.57 ops/s | [19.53 ops/s, 19.61 ops/s] | 19.61 ops/s | skewed
iterable > iter-tools __takeSorted + toArray > n=1000000 k=100 | 30 | 3.44 ops/s | [3.38 ops/s, 3.50 ops/s] | 3.51 ops/s | skewed
iterable > toArray + sort + slice > n=1000000 k=100 | 30 | 1.51 ops/s | [1.50 ops/s, 1.51 ops/s] | 1.51 ops/s | skewed
array > polyfill .top > n=1000000 k=1000 | 30 | 32.49 ops/s | [32.38 ops/s, 32.60 ops/s] | 32.46 ops/s |
array > iter-tools __takeSorted + toArray > n=1000000 k=1000 | 30 | 2.76 ops/s | [2.75 ops/s, 2.76 ops/s] | 2.76 ops/s |
array > toSorted + slice > n=1000000 k=1000 | 30 | 1.35 ops/s | [1.29 ops/s, 1.41 ops/s] | 1.30 ops/s | noisy
iterable > polyfill .top > n=1000000 k=1000 | 30 | 18.58 ops/s | [18.54 ops/s, 18.63 ops/s] | 18.64 ops/s |
iterable > iter-tools __takeSorted + toArray > n=1000000 k=1000 | 30 | 2.51 ops/s | [2.45 ops/s, 2.56 ops/s] | 2.62 ops/s | noisy
iterable > toArray + sort + slice > n=1000000 k=1000 | 30 | 1.51 ops/s | [1.51 ops/s, 1.51 ops/s] | 1.51 ops/s | skewed
array > polyfill .top > n=1000000 k=10000 | 30 | 16.24 ops/s | [16.15 ops/s, 16.33 ops/s] | 16.19 ops/s |
array > iter-tools __takeSorted + toArray > n=1000000 k=10000 | 30 | 1.92 ops/s | [1.88 ops/s, 1.95 ops/s] | 1.97 ops/s |
array > toSorted + slice > n=1000000 k=10000 | 30 | 1.34 ops/s | [1.28 ops/s, 1.40 ops/s] | 1.27 ops/s | noisy
iterable > polyfill .top > n=1000000 k=10000 | 30 | 12.10 ops/s | [12.05 ops/s, 12.16 ops/s] | 12.08 ops/s |
iterable > iter-tools __takeSorted + toArray > n=1000000 k=10000 | 30 | 1.85 ops/s | [1.82 ops/s, 1.89 ops/s] | 1.92 ops/s | noisy
iterable > toArray + sort + slice > n=1000000 k=10000 | 30 | 1.51 ops/s | [1.51 ops/s, 1.51 ops/s] | 1.51 ops/s | skewed
array > polyfill .top > n=1000000 k=100000 | 30 | 2.84 ops/s | [2.83 ops/s, 2.85 ops/s] | 2.84 ops/s | skewed
array > iter-tools __takeSorted + toArray > n=1000000 k=100000 | 30 | 1.45 ops/s | [1.45 ops/s, 1.45 ops/s] | 1.45 ops/s |
array > toSorted + slice > n=1000000 k=100000 | 30 | 1.34 ops/s | [1.28 ops/s, 1.41 ops/s] | 1.32 ops/s | noisy
iterable > polyfill .top > n=1000000 k=100000 | 30 | 2.68 ops/s | [2.67 ops/s, 2.69 ops/s] | 2.68 ops/s | skewed
iterable > iter-tools __takeSorted + toArray > n=1000000 k=100000 | 30 | 1.44 ops/s | [1.42 ops/s, 1.45 ops/s] | 1.43 ops/s |
iterable > toArray + sort + slice > n=1000000 k=100000 | 30 | 1.49 ops/s | [1.48 ops/s, 1.49 ops/s] | 1.49 ops/s | skewed
array > polyfill .top > n=1000000 k=1000000 | 30 | 1.25 ops/s | [1.24 ops/s, 1.26 ops/s] | 1.26 ops/s |
array > iter-tools __takeSorted + toArray > n=1000000 k=1000000 | 30 | 1.03 ops/s | [1.03 ops/s, 1.04 ops/s] | 1.04 ops/s |
array > toSorted + slice > n=1000000 k=1000000 | 30 | 1.20 ops/s | [1.18 ops/s, 1.22 ops/s] | 1.21 ops/s |
iterable > polyfill .top > n=1000000 k=1000000 | 30 | 1.32 ops/s | [1.32 ops/s, 1.32 ops/s] | 1.32 ops/s |
iterable > iter-tools __takeSorted + toArray > n=1000000 k=1000000 | 30 | 1.01 ops/s | [1.01 ops/s, 1.02 ops/s] | 1.01 ops/s | skewed
iterable > toArray + sort + slice > n=1000000 k=1000000 | 30 | 1.44 ops/s | [1.43 ops/s, 1.45 ops/s] | 1.43 ops/s | skewed

162 completed, 0 failed, 0 skipped
```

</details>

- 🟢 means polyfill is faster than native sort
- 🔴 means polyfill is slower than native sort
- 🟡 means polyfill is slower than native sort but `n === k` so partial sort wasn't required

| Benchmark | Input | n | k | Mean rate | 95% CI | Median rate | Relative |
|---|---|---:|---:|---:|---|---:|---:|
| polyfill .top | array | 10 | 1 | 225.66k ops/s | [222.20k ops/s, 229.13k ops/s] | 227.25k ops/s | 🔴 1.00x (baseline) |
| iter-tools __takeSorted + toArray | array | 10 | 1 | 30.73k ops/s | [29.11k ops/s, 32.36k ops/s] | 32.12k ops/s | 7.34x slower |
| toSorted + slice | array | 10 | 1 | 304.43k ops/s | [299.69k ops/s, 309.18k ops/s] | 305.06k ops/s | **1.35x faster** |
| polyfill .top | iterable | 10 | 1 | 167.81k ops/s | [153.64k ops/s, 181.97k ops/s] | 166.52k ops/s | 🔴 1.00x (baseline) |
| iter-tools __takeSorted + toArray | iterable | 10 | 1 | 38.58k ops/s | [34.99k ops/s, 42.17k ops/s] | 43.31k ops/s | 4.35x slower |
| toArray + sort + slice | iterable | 10 | 1 | 204.50k ops/s | [192.85k ops/s, 216.15k ops/s] | 209.97k ops/s | **1.22x faster** |
| polyfill .top | array | 10 | 10 | 125.21k ops/s | [118.47k ops/s, 131.94k ops/s] | 128.61k ops/s | 🟡 1.00x (baseline) |
| iter-tools __takeSorted + toArray | array | 10 | 10 | 30.88k ops/s | [28.66k ops/s, 33.10k ops/s] | 32.85k ops/s | 4.05x slower |
| toSorted + slice | array | 10 | 10 | 238.59k ops/s | [231.14k ops/s, 246.04k ops/s] | 244.20k ops/s | **1.91x faster** |
| polyfill .top | iterable | 10 | 10 | 153.90k ops/s | [135.27k ops/s, 172.53k ops/s] | 144.51k ops/s | 🟡 1.00x (baseline) |
| iter-tools __takeSorted + toArray | iterable | 10 | 10 | 35.86k ops/s | [32.76k ops/s, 38.96k ops/s] | 33.92k ops/s | 4.29x slower |
| toArray + sort + slice | iterable | 10 | 10 | 212.25k ops/s | [203.70k ops/s, 220.81k ops/s] | 212.86k ops/s | **1.38x faster** |
| polyfill .top | array | 100 | 1 | 179.60k ops/s | [171.73k ops/s, 187.46k ops/s] | 185.15k ops/s | 🟢 1.00x (baseline) |
| iter-tools __takeSorted + toArray | array | 100 | 1 | 22.17k ops/s | [21.70k ops/s, 22.64k ops/s] | 22.51k ops/s | 8.10x slower |
| toSorted + slice | array | 100 | 1 | 47.70k ops/s | [46.48k ops/s, 48.93k ops/s] | 48.72k ops/s | **3.77x slower** |
| polyfill .top | iterable | 100 | 1 | 121.66k ops/s | [117.39k ops/s, 125.94k ops/s] | 123.93k ops/s | 🟢 1.00x (baseline) |
| iter-tools __takeSorted + toArray | iterable | 100 | 1 | 28.80k ops/s | [28.27k ops/s, 29.32k ops/s] | 29.13k ops/s | 4.22x slower |
| toArray + sort + slice | iterable | 100 | 1 | 35.89k ops/s | [35.56k ops/s, 36.21k ops/s] | 35.83k ops/s | **3.39x slower** |
| polyfill .top | array | 100 | 10 | 36.02k ops/s | [31.78k ops/s, 40.26k ops/s] | 41.20k ops/s | 🔴 1.00x (baseline) |
| iter-tools __takeSorted + toArray | array | 100 | 10 | 19.90k ops/s | [18.93k ops/s, 20.86k ops/s] | 20.64k ops/s | 1.81x slower |
| toSorted + slice | array | 100 | 10 | 48.53k ops/s | [48.18k ops/s, 48.88k ops/s] | 48.89k ops/s | **1.35x faster** |
| polyfill .top | iterable | 100 | 10 | 52.42k ops/s | [46.68k ops/s, 58.16k ops/s] | 62.10k ops/s | 🟢 1.00x (baseline) |
| iter-tools __takeSorted + toArray | iterable | 100 | 10 | 23.11k ops/s | [22.20k ops/s, 24.02k ops/s] | 23.69k ops/s | 2.27x slower |
| toArray + sort + slice | iterable | 100 | 10 | 20.71k ops/s | [18.76k ops/s, 22.65k ops/s] | 22.57k ops/s | **2.53x slower** |
| polyfill .top | array | 100 | 100 | 23.04k ops/s | [20.71k ops/s, 25.37k ops/s] | 18.86k ops/s | 🟡 1.00x (baseline) |
| iter-tools __takeSorted + toArray | array | 100 | 100 | 16.55k ops/s | [15.88k ops/s, 17.22k ops/s] | 17.49k ops/s | 1.39x slower |
| toSorted + slice | array | 100 | 100 | 48.35k ops/s | [47.94k ops/s, 48.76k ops/s] | 48.30k ops/s | **2.10x faster** |
| polyfill .top | iterable | 100 | 100 | 29.87k ops/s | [29.64k ops/s, 30.10k ops/s] | 29.89k ops/s | 🟡 1.00x (baseline) |
| iter-tools __takeSorted + toArray | iterable | 100 | 100 | 12.25k ops/s | [11.62k ops/s, 12.87k ops/s] | 12.73k ops/s | 2.44x slower |
| toArray + sort + slice | iterable | 100 | 100 | 34.18k ops/s | [32.43k ops/s, 35.93k ops/s] | 35.77k ops/s | **1.14x faster** |
| polyfill .top | array | 1000 | 1 | 25.19k ops/s | [24.55k ops/s, 25.84k ops/s] | 25.84k ops/s | 🟢 1.00x (baseline) |
| iter-tools __takeSorted + toArray | array | 1000 | 1 | 6.23k ops/s | [6.12k ops/s, 6.35k ops/s] | 6.32k ops/s | 4.04x slower |
| toSorted + slice | array | 1000 | 1 | 2.33k ops/s | [2.01k ops/s, 2.65k ops/s] | 1.96k ops/s | **10.81x slower** |
| polyfill .top | iterable | 1000 | 1 | 18.52k ops/s | [18.17k ops/s, 18.87k ops/s] | 18.83k ops/s | 🟢 1.00x (baseline) |
| iter-tools __takeSorted + toArray | iterable | 1000 | 1 | 2.74k ops/s | [2.51k ops/s, 2.97k ops/s] | 2.62k ops/s | 6.76x slower |
| toArray + sort + slice | iterable | 1000 | 1 | 3.03k ops/s | [3.01k ops/s, 3.05k ops/s] | 3.05k ops/s | **6.11x slower** |
| polyfill .top | array | 1000 | 10 | 26.86k ops/s | [26.43k ops/s, 27.29k ops/s] | 27.30k ops/s | 🟢 1.00x (baseline) |
| iter-tools __takeSorted + toArray | array | 1000 | 10 | 3.07k ops/s | [3.02k ops/s, 3.13k ops/s] | 3.12k ops/s | 8.75x slower |
| toSorted + slice | array | 1000 | 10 | 3.72k ops/s | [3.69k ops/s, 3.75k ops/s] | 3.71k ops/s | **7.22x slower** |
| polyfill .top | iterable | 1000 | 10 | 16.75k ops/s | [16.56k ops/s, 16.93k ops/s] | 16.92k ops/s | 🟢 1.00x (baseline) |
| iter-tools __takeSorted + toArray | iterable | 1000 | 10 | 3.98k ops/s | [3.91k ops/s, 4.05k ops/s] | 4.07k ops/s | 4.21x slower |
| toArray + sort + slice | iterable | 1000 | 10 | 2.45k ops/s | [2.23k ops/s, 2.67k ops/s] | 2.38k ops/s | **6.84x slower** |
| polyfill .top | array | 1000 | 100 | 4.43k ops/s | [4.26k ops/s, 4.59k ops/s] | 4.55k ops/s | 🟢 1.00x (baseline) |
| iter-tools __takeSorted + toArray | array | 1000 | 100 | 2.78k ops/s | [2.72k ops/s, 2.84k ops/s] | 2.83k ops/s | 1.59x slower |
| toSorted + slice | array | 1000 | 100 | 3.79k ops/s | [3.77k ops/s, 3.81k ops/s] | 3.82k ops/s | **1.17x slower** |
| polyfill .top | iterable | 1000 | 100 | 8.61k ops/s | [8.51k ops/s, 8.70k ops/s] | 8.63k ops/s | 🟢 1.00x (baseline) |
| iter-tools __takeSorted + toArray | iterable | 1000 | 100 | 2.06k ops/s | [1.89k ops/s, 2.24k ops/s] | 1.87k ops/s | 4.18x slower |
| toArray + sort + slice | iterable | 1000 | 100 | 2.17k ops/s | [1.96k ops/s, 2.37k ops/s] | 1.89k ops/s | **3.97x slower** |
| polyfill .top | array | 1000 | 1000 | 3.09k ops/s | [3.07k ops/s, 3.10k ops/s] | 3.10k ops/s | 🟡 1.00x (baseline) |
| iter-tools __takeSorted + toArray | array | 1000 | 1000 | 1.59k ops/s | [1.52k ops/s, 1.66k ops/s] | 1.47k ops/s | 1.94x slower |
| toSorted + slice | array | 1000 | 1000 | 3.78k ops/s | [3.76k ops/s, 3.80k ops/s] | 3.80k ops/s | **1.22x faster** |
| polyfill .top | iterable | 1000 | 1000 | 2.45k ops/s | [2.25k ops/s, 2.65k ops/s] | 2.82k ops/s | 🟢 1.00x (baseline) |
| iter-tools __takeSorted + toArray | iterable | 1000 | 1000 | 1.79k ops/s | [1.77k ops/s, 1.81k ops/s] | 1.80k ops/s | 1.37x slower |
| toArray + sort + slice | iterable | 1000 | 1000 | 2.20k ops/s | [2.00k ops/s, 2.40k ops/s] | 1.88k ops/s | **1.11x slower** |
| polyfill .top | array | 10000 | 1 | 2.85k ops/s | [2.58k ops/s, 3.11k ops/s] | 3.29k ops/s | 🟢 1.00x (baseline) |
| iter-tools __takeSorted + toArray | array | 10000 | 1 | 761.98 ops/s | [728.45 ops/s, 795.51 ops/s] | 803.66 ops/s | 3.74x slower |
| toSorted + slice | array | 10000 | 1 | 301.53 ops/s | [301.34 ops/s, 301.72 ops/s] | 301.74 ops/s | **9.45x slower** |
| polyfill .top | iterable | 10000 | 1 | 1.93k ops/s | [1.91k ops/s, 1.95k ops/s] | 1.94k ops/s | 🟢 1.00x (baseline) |
| iter-tools __takeSorted + toArray | iterable | 10000 | 1 | 661.21 ops/s | [650.83 ops/s, 671.58 ops/s] | 673.17 ops/s | 2.92x slower |
| toArray + sort + slice | iterable | 10000 | 1 | 251.40 ops/s | [251.21 ops/s, 251.59 ops/s] | 251.41 ops/s | **7.68x slower** |
| polyfill .top | array | 10000 | 10 | 3.49k ops/s | [3.45k ops/s, 3.52k ops/s] | 3.53k ops/s | 🟢 1.00x (baseline) |
| iter-tools __takeSorted + toArray | array | 10000 | 10 | 509.55 ops/s | [507.59 ops/s, 511.51 ops/s] | 511.27 ops/s | 6.85x slower |
| toSorted + slice | array | 10000 | 10 | 301.25 ops/s | [301.01 ops/s, 301.49 ops/s] | 301.42 ops/s | **11.59x slower** |
| polyfill .top | iterable | 10000 | 10 | 1.92k ops/s | [1.91k ops/s, 1.93k ops/s] | 1.91k ops/s | 🟢 1.00x (baseline) |
| iter-tools __takeSorted + toArray | iterable | 10000 | 10 | 454.69 ops/s | [454.40 ops/s, 454.98 ops/s] | 455.01 ops/s | 4.22x slower |
| toArray + sort + slice | iterable | 10000 | 10 | 251.15 ops/s | [250.95 ops/s, 251.36 ops/s] | 251.19 ops/s | **7.64x slower** |
| polyfill .top | array | 10000 | 100 | 2.64k ops/s | [2.62k ops/s, 2.65k ops/s] | 2.64k ops/s | 🟢 1.00x (baseline) |
| iter-tools __takeSorted + toArray | array | 10000 | 100 | 333.81 ops/s | [333.54 ops/s, 334.07 ops/s] | 333.91 ops/s | 7.91x slower |
| toSorted + slice | array | 10000 | 100 | 301.28 ops/s | [301.12 ops/s, 301.45 ops/s] | 301.29 ops/s | **8.76x slower** |
| polyfill .top | iterable | 10000 | 100 | 1.64k ops/s | [1.63k ops/s, 1.65k ops/s] | 1.64k ops/s | 🟢 1.00x (baseline) |
| iter-tools __takeSorted + toArray | iterable | 10000 | 100 | 348.28 ops/s | [347.61 ops/s, 348.96 ops/s] | 348.89 ops/s | 4.71x slower |
| toArray + sort + slice | iterable | 10000 | 100 | 282.65 ops/s | [282.16 ops/s, 283.15 ops/s] | 282.89 ops/s | **5.80x slower** |
| polyfill .top | array | 10000 | 1000 | 899.00 ops/s | [896.08 ops/s, 901.92 ops/s] | 899.56 ops/s | 🟢 1.00x (baseline) |
| iter-tools __takeSorted + toArray | array | 10000 | 1000 | 266.31 ops/s | [266.10 ops/s, 266.53 ops/s] | 266.44 ops/s | 3.38x slower |
| toSorted + slice | array | 10000 | 1000 | 339.50 ops/s | [339.16 ops/s, 339.83 ops/s] | 339.66 ops/s | **2.65x slower** |
| polyfill .top | iterable | 10000 | 1000 | 766.87 ops/s | [762.99 ops/s, 770.75 ops/s] | 770.32 ops/s | 🟢 1.00x (baseline) |
| iter-tools __takeSorted + toArray | iterable | 10000 | 1000 | 252.16 ops/s | [251.67 ops/s, 252.66 ops/s] | 252.66 ops/s | 3.04x slower |
| toArray + sort + slice | iterable | 10000 | 1000 | 282.30 ops/s | [281.81 ops/s, 282.79 ops/s] | 282.58 ops/s | **2.72x slower** |
| polyfill .top | array | 10000 | 10000 | 271.77 ops/s | [271.38 ops/s, 272.17 ops/s] | 271.92 ops/s | 🟡 1.00x (baseline) |
| iter-tools __takeSorted + toArray | array | 10000 | 10000 | 178.44 ops/s | [178.20 ops/s, 178.68 ops/s] | 178.63 ops/s | 1.52x slower |
| toSorted + slice | array | 10000 | 10000 | 337.92 ops/s | [337.38 ops/s, 338.45 ops/s] | 337.78 ops/s | **1.24x faster** |
| polyfill .top | iterable | 10000 | 10000 | 261.00 ops/s | [260.69 ops/s, 261.30 ops/s] | 261.26 ops/s | 🟡 1.00x (baseline) |
| iter-tools __takeSorted + toArray | iterable | 10000 | 10000 | 174.02 ops/s | [173.94 ops/s, 174.09 ops/s] | 174.02 ops/s | 1.50x slower |
| toArray + sort + slice | iterable | 10000 | 10000 | 282.28 ops/s | [282.01 ops/s, 282.54 ops/s] | 282.43 ops/s | **1.08x faster** |
| polyfill .top | array | 100000 | 1 | 414.23 ops/s | [412.80 ops/s, 415.65 ops/s] | 415.13 ops/s | 🟢 1.00x (baseline) |
| iter-tools __takeSorted + toArray | array | 100000 | 1 | 81.82 ops/s | [81.67 ops/s, 81.97 ops/s] | 81.87 ops/s | 5.06x slower |
| toSorted + slice | array | 100000 | 1 | 22.38 ops/s | [22.09 ops/s, 22.68 ops/s] | 22.40 ops/s | **18.51x slower** |
| polyfill .top | iterable | 100000 | 1 | 198.27 ops/s | [198.03 ops/s, 198.50 ops/s] | 198.36 ops/s | 🟢 1.00x (baseline) |
| iter-tools __takeSorted + toArray | iterable | 100000 | 1 | 68.53 ops/s | [68.43 ops/s, 68.62 ops/s] | 68.52 ops/s | 2.89x slower |
| toArray + sort + slice | iterable | 100000 | 1 | 20.04 ops/s | [20.03 ops/s, 20.05 ops/s] | 20.05 ops/s | **9.89x slower** |
| polyfill .top | array | 100000 | 10 | 398.92 ops/s | [391.24 ops/s, 406.61 ops/s] | 412.15 ops/s | 🟢 1.00x (baseline) |
| iter-tools __takeSorted + toArray | array | 100000 | 10 | 58.14 ops/s | [57.92 ops/s, 58.36 ops/s] | 58.21 ops/s | 6.86x slower |
| toSorted + slice | array | 100000 | 10 | 22.30 ops/s | [22.10 ops/s, 22.49 ops/s] | 22.40 ops/s | **17.89x slower** |
| polyfill .top | iterable | 100000 | 10 | 198.50 ops/s | [198.27 ops/s, 198.72 ops/s] | 198.54 ops/s | 🟢 1.00x (baseline) |
| iter-tools __takeSorted + toArray | iterable | 100000 | 10 | 45.85 ops/s | [45.80 ops/s, 45.89 ops/s] | 45.86 ops/s | 4.33x slower |
| toArray + sort + slice | iterable | 100000 | 10 | 21.38 ops/s | [20.92 ops/s, 21.83 ops/s] | 22.43 ops/s | **9.28x slower** |
| polyfill .top | array | 100000 | 100 | 394.65 ops/s | [393.58 ops/s, 395.72 ops/s] | 395.18 ops/s | 🟢 1.00x (baseline) |
| iter-tools __takeSorted + toArray | array | 100000 | 100 | 38.11 ops/s | [38.07 ops/s, 38.15 ops/s] | 38.14 ops/s | 10.36x slower |
| toSorted + slice | array | 100000 | 100 | 24.93 ops/s | [24.71 ops/s, 25.15 ops/s] | 25.05 ops/s | **15.83x slower** |
| polyfill .top | iterable | 100000 | 100 | 193.66 ops/s | [193.36 ops/s, 193.97 ops/s] | 193.93 ops/s | 🟢 1.00x (baseline) |
| iter-tools __takeSorted + toArray | iterable | 100000 | 100 | 31.28 ops/s | [31.27 ops/s, 31.29 ops/s] | 31.28 ops/s | 6.19x slower |
| toArray + sort + slice | iterable | 100000 | 100 | 21.92 ops/s | [21.53 ops/s, 22.31 ops/s] | 22.48 ops/s | **8.83x slower** |
| polyfill .top | array | 100000 | 1000 | 247.47 ops/s | [246.75 ops/s, 248.19 ops/s] | 247.79 ops/s | 🟢 1.00x (baseline) |
| iter-tools __takeSorted + toArray | array | 100000 | 1000 | 27.51 ops/s | [27.49 ops/s, 27.53 ops/s] | 27.53 ops/s | 9.00x slower |
| toSorted + slice | array | 100000 | 1000 | 24.25 ops/s | [23.77 ops/s, 24.72 ops/s] | 25.03 ops/s | **10.20x slower** |
| polyfill .top | iterable | 100000 | 1000 | 148.46 ops/s | [148.26 ops/s, 148.66 ops/s] | 148.49 ops/s | 🟢 1.00x (baseline) |
| iter-tools __takeSorted + toArray | iterable | 100000 | 1000 | 23.00 ops/s | [22.98 ops/s, 23.02 ops/s] | 23.02 ops/s | 6.45x slower |
| toArray + sort + slice | iterable | 100000 | 1000 | 20.98 ops/s | [20.53 ops/s, 21.42 ops/s] | 20.07 ops/s | **7.08x slower** |
| polyfill .top | array | 100000 | 10000 | 56.49 ops/s | [55.59 ops/s, 57.39 ops/s] | 55.26 ops/s | 🟢 1.00x (baseline) |
| iter-tools __takeSorted + toArray | array | 100000 | 10000 | 17.77 ops/s | [17.66 ops/s, 17.89 ops/s] | 17.69 ops/s | 3.18x slower |
| toSorted + slice | array | 100000 | 10000 | 25.06 ops/s | [25.04 ops/s, 25.07 ops/s] | 25.06 ops/s | **2.25x slower** |
| polyfill .top | iterable | 100000 | 10000 | 49.63 ops/s | [49.54 ops/s, 49.72 ops/s] | 49.72 ops/s | 🟢 1.00x (baseline) |
| iter-tools __takeSorted + toArray | iterable | 100000 | 10000 | 17.16 ops/s | [17.15 ops/s, 17.16 ops/s] | 17.16 ops/s | 2.89x slower |
| toArray + sort + slice | iterable | 100000 | 10000 | 22.45 ops/s | [22.44 ops/s, 22.47 ops/s] | 22.46 ops/s | **2.21x slower** |
| polyfill .top | array | 100000 | 100000 | 20.93 ops/s | [20.92 ops/s, 20.94 ops/s] | 20.92 ops/s | 🟡 1.00x (baseline) |
| iter-tools __takeSorted + toArray | array | 100000 | 100000 | 13.86 ops/s | [13.57 ops/s, 14.16 ops/s] | 13.28 ops/s | 1.51x slower |
| toSorted + slice | array | 100000 | 100000 | 22.62 ops/s | [22.16 ops/s, 23.09 ops/s] | 22.33 ops/s | **1.08x faster** |
| polyfill .top | iterable | 100000 | 100000 | 18.15 ops/s | [18.08 ops/s, 18.21 ops/s] | 18.20 ops/s | 🟡 1.00x (baseline) |
| iter-tools __takeSorted + toArray | iterable | 100000 | 100000 | 13.38 ops/s | [13.12 ops/s, 13.64 ops/s] | 12.99 ops/s | 1.36x slower |
| toArray + sort + slice | iterable | 100000 | 100000 | 19.99 ops/s | [19.98 ops/s, 19.99 ops/s] | 19.99 ops/s | **1.10x faster** |
| polyfill .top | array | 1000000 | 1 | 40.19 ops/s | [40.06 ops/s, 40.32 ops/s] | 40.02 ops/s | 🟢 1.00x (baseline) |
| iter-tools __takeSorted + toArray | array | 1000000 | 1 | 9.04 ops/s | [8.98 ops/s, 9.10 ops/s] | 9.11 ops/s | 4.45x slower |
| toSorted + slice | array | 1000000 | 1 | 1.34 ops/s | [1.28 ops/s, 1.41 ops/s] | 1.27 ops/s | **29.99x slower** |
| polyfill .top | iterable | 1000000 | 1 | 19.61 ops/s | [19.55 ops/s, 19.67 ops/s] | 19.67 ops/s | 🟢 1.00x (baseline) |
| iter-tools __takeSorted + toArray | iterable | 1000000 | 1 | 7.76 ops/s | [7.75 ops/s, 7.77 ops/s] | 7.76 ops/s | 2.53x slower |
| toArray + sort + slice | iterable | 1000000 | 1 | 1.51 ops/s | [1.51 ops/s, 1.51 ops/s] | 1.52 ops/s | **12.99x slower** |
| polyfill .top | array | 1000000 | 10 | 35.99 ops/s | [35.88 ops/s, 36.10 ops/s] | 35.87 ops/s | 🟢 1.00x (baseline) |
| iter-tools __takeSorted + toArray | array | 1000000 | 10 | 5.68 ops/s | [5.60 ops/s, 5.76 ops/s] | 5.76 ops/s | 6.34x slower |
| toSorted + slice | array | 1000000 | 10 | 1.35 ops/s | [1.28 ops/s, 1.41 ops/s] | 1.27 ops/s | **26.66x slower** |
| polyfill .top | iterable | 1000000 | 10 | 19.63 ops/s | [19.60 ops/s, 19.65 ops/s] | 19.65 ops/s | 🟢 1.00x (baseline) |
| iter-tools __takeSorted + toArray | iterable | 1000000 | 10 | 4.98 ops/s | [4.88 ops/s, 5.08 ops/s] | 5.16 ops/s | 3.94x slower |
| toArray + sort + slice | iterable | 1000000 | 10 | 1.51 ops/s | [1.50 ops/s, 1.51 ops/s] | 1.51 ops/s | **13.00x slower** |
| polyfill .top | array | 1000000 | 100 | 35.64 ops/s | [35.53 ops/s, 35.75 ops/s] | 35.54 ops/s | 🟢 1.00x (baseline) |
| iter-tools __takeSorted + toArray | array | 1000000 | 100 | 3.68 ops/s | [3.61 ops/s, 3.75 ops/s] | 3.78 ops/s | 9.68x slower |
| toSorted + slice | array | 1000000 | 100 | 1.35 ops/s | [1.29 ops/s, 1.42 ops/s] | 1.35 ops/s | **26.40x slower** |
| polyfill .top | iterable | 1000000 | 100 | 19.57 ops/s | [19.53 ops/s, 19.61 ops/s] | 19.61 ops/s | 🟢 1.00x (baseline) |
| iter-tools __takeSorted + toArray | iterable | 1000000 | 100 | 3.44 ops/s | [3.38 ops/s, 3.50 ops/s] | 3.51 ops/s | 5.69x slower |
| toArray + sort + slice | iterable | 1000000 | 100 | 1.51 ops/s | [1.50 ops/s, 1.51 ops/s] | 1.51 ops/s | **12.96x slower** |
| polyfill .top | array | 1000000 | 1000 | 32.49 ops/s | [32.38 ops/s, 32.60 ops/s] | 32.46 ops/s | 🟢 1.00x (baseline) |
| iter-tools __takeSorted + toArray | array | 1000000 | 1000 | 2.76 ops/s | [2.75 ops/s, 2.76 ops/s] | 2.76 ops/s | 11.77x slower |
| toSorted + slice | array | 1000000 | 1000 | 1.35 ops/s | [1.29 ops/s, 1.41 ops/s] | 1.30 ops/s | **24.07x slower** |
| polyfill .top | iterable | 1000000 | 1000 | 18.58 ops/s | [18.54 ops/s, 18.63 ops/s] | 18.64 ops/s | 🟢 1.00x (baseline) |
| iter-tools __takeSorted + toArray | iterable | 1000000 | 1000 | 2.51 ops/s | [2.45 ops/s, 2.56 ops/s] | 2.62 ops/s | 7.40x slower |
| toArray + sort + slice | iterable | 1000000 | 1000 | 1.51 ops/s | [1.51 ops/s, 1.51 ops/s] | 1.51 ops/s | **12.30x slower** |
| polyfill .top | array | 1000000 | 10000 | 16.24 ops/s | [16.15 ops/s, 16.33 ops/s] | 16.19 ops/s | 🟢 1.00x (baseline) |
| iter-tools __takeSorted + toArray | array | 1000000 | 10000 | 1.92 ops/s | [1.88 ops/s, 1.95 ops/s] | 1.97 ops/s | 8.46x slower |
| toSorted + slice | array | 1000000 | 10000 | 1.34 ops/s | [1.28 ops/s, 1.40 ops/s] | 1.27 ops/s | **12.12x slower** |
| polyfill .top | iterable | 1000000 | 10000 | 12.10 ops/s | [12.05 ops/s, 12.16 ops/s] | 12.08 ops/s | 🟢 1.00x (baseline) |
| iter-tools __takeSorted + toArray | iterable | 1000000 | 10000 | 1.85 ops/s | [1.82 ops/s, 1.89 ops/s] | 1.92 ops/s | 6.54x slower |
| toArray + sort + slice | iterable | 1000000 | 10000 | 1.51 ops/s | [1.51 ops/s, 1.51 ops/s] | 1.51 ops/s | **8.01x slower** |
| polyfill .top | array | 1000000 | 100000 | 2.84 ops/s | [2.83 ops/s, 2.85 ops/s] | 2.84 ops/s | 🟢 1.00x (baseline) |
| iter-tools __takeSorted + toArray | array | 1000000 | 100000 | 1.45 ops/s | [1.45 ops/s, 1.45 ops/s] | 1.45 ops/s | 1.96x slower |
| toSorted + slice | array | 1000000 | 100000 | 1.34 ops/s | [1.28 ops/s, 1.41 ops/s] | 1.32 ops/s | **2.12x slower** |
| polyfill .top | iterable | 1000000 | 100000 | 2.68 ops/s | [2.67 ops/s, 2.69 ops/s] | 2.68 ops/s | 🟢 1.00x (baseline) |
| iter-tools __takeSorted + toArray | iterable | 1000000 | 100000 | 1.44 ops/s | [1.42 ops/s, 1.45 ops/s] | 1.43 ops/s | 1.86x slower |
| toArray + sort + slice | iterable | 1000000 | 100000 | 1.49 ops/s | [1.48 ops/s, 1.49 ops/s] | 1.49 ops/s | **1.80x slower** |
| polyfill .top | array | 1000000 | 1000000 | 1.25 ops/s | [1.24 ops/s, 1.26 ops/s] | 1.26 ops/s | 🟢 1.00x (baseline) |
| iter-tools __takeSorted + toArray | array | 1000000 | 1000000 | 1.03 ops/s | [1.03 ops/s, 1.04 ops/s] | 1.04 ops/s | 1.21x slower |
| toSorted + slice | array | 1000000 | 1000000 | 1.20 ops/s | [1.18 ops/s, 1.22 ops/s] | 1.21 ops/s | **1.04x slower** |
| polyfill .top | iterable | 1000000 | 1000000 | 1.32 ops/s | [1.32 ops/s, 1.32 ops/s] | 1.32 ops/s | 🟡 1.00x (baseline) |
| iter-tools __takeSorted + toArray | iterable | 1000000 | 1000000 | 1.01 ops/s | [1.01 ops/s, 1.02 ops/s] | 1.01 ops/s | 1.31x slower |
| toArray + sort + slice | iterable | 1000000 | 1000000 | 1.44 ops/s | [1.43 ops/s, 1.45 ops/s] | 1.43 ops/s | **1.09x faster** |
