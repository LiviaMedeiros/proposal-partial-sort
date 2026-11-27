import { bench, suite } from 'node:bench';
import { deepEqual } from 'node:assert/strict';
import { __takeSorted } from 'iter-tools';
import './polyfill.mjs';

const compareAsc = (a, b) => (a > b) - (a < b);

// deterministic random for easier verification
function makeArray(n) {
  return Array.from({ length: n }, (_, i) => (i * 0x9e3779b1) >>> 0);
}
function* makeIterable(n) {
  for (let i = 0; i < n; i++) yield (i * 0x9e3779b1) >>> 0;
}

const sizes = [
  { n: 1e1, ks: [1e1] },
  { n: 1e2, ks: [1e1, 1e2] },
  { n: 1e3, ks: [1e1, 1e2, 1e3] },
  { n: 1e4, ks: [1e1, 1e2, 1e3, 1e4] },
  { n: 1e5, ks: [1e1, 1e2, 1e3, 1e4, 1e5] },
  { n: 1e6, ks: [1e1, 1e2, 1e3, 1e4, 1e5, 1e6] },
];

for (const { n, ks } of sizes) {
  const data = makeArray(n);

  for (const k of ks) {
    const expected = data.toSorted(compareAsc).slice(-k);
    const label = `n=${n} k=${k}`;

    suite(`array ${label}`, () => {
      bench(`array > polyfill .top > ${label}`, (b) => {
        b.start();
        const result = data.top(k, compareAsc);
        b.end(1);
        deepEqual(result, expected);
      });
      bench(`array > iter-tools __takeSorted + toArray > ${label}`, (b) => {
        b.start();
        const result = __takeSorted(data, k, compareAsc).toArray();
        b.end(1);
        deepEqual(result, expected);
      });
      bench(`array > toSorted + slice > ${label}`, (b) => {
        b.start();
        const result = data.toSorted(compareAsc).slice(-k);
        b.end(1);
        deepEqual(result, expected);
      });
    });

    suite(`iterable ${label}`, () => {
      bench(`iterable > polyfill .top > ${label}`, (b) => {
        const iterable = makeIterable(n);
        b.start();
        const result = iterable.top(k, compareAsc);
        b.end(1);
        deepEqual(result, expected);
      });
      bench(`iterable > iter-tools __takeSorted + toArray > ${label}`, (b) => {
        const iterable = makeIterable(n);
        b.start();
        const result = __takeSorted(iterable, k, compareAsc).toArray();
        b.end(1);
        deepEqual(result, expected);
      });
      bench(`iterable > toArray + sort + slice > ${label}`, (b) => {
        const iterable = makeIterable(n);
        b.start();
        const result = iterable.toArray().sort(compareAsc).slice(-k);
        b.end(1);
        deepEqual(result, expected);
      });
    });
  }
}