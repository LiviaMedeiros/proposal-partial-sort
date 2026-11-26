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

TBD
