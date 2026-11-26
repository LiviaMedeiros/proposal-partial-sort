/**
 * This is draft polyfill for `Array.prototype.top(k, compareFn)`,
 * proposed in https://github.com/LiviaMedeiros/proposal-partial-sort
 *
 * This polyfill exists solely to demonstrate the concept and
 * allow to benchmark this against other solutions.
 * Please do not use this in production, or at all.
 */

const defaultCompareFn = (a , b) => (a > b) - (a < b);

function top(k = 1, compareFn = defaultCompareFn) {
  if (k <= 0)
    return [];
  const heap = [];
  let size = 0;

  const siftDown = (parent) => {
    for (;;) {
      let smallest = parent;
      const left = (parent << 1) + 1;
      const right = left + 1;
      if (left < size && compareFn(heap[left], heap[smallest]) < 0)
        smallest = left;
      if (right < size && compareFn(heap[right], heap[smallest]) < 0)
        smallest = right;
      if (smallest === parent)
        break;
      [
        heap[parent],
        heap[smallest],
      ] = [
        heap[smallest],
        heap[parent],
      ];
      parent = smallest;
    }
  };

  for (const value of this) {
    if (size < k) {
      heap[size++] = value;
      if (size === k)
        for (let i = k >> 1; i --> 0; siftDown(i));
    } else if (compareFn(value, heap[0]) > 0) {
      heap[0] = value;
      siftDown(0);
    }
  }

  return heap.sort(compareFn);
};

Array.prototype.top = Iterator.prototype.top = top;
