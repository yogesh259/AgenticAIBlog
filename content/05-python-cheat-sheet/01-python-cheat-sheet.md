+++
number = "5.1"
title = "Python cheat sheet"
lede = "The Python that coding problems use, on one page: syntax, the built-in data structures and library tools, what each operation costs, and practice tasks for every section."
summary = "Python for coding problems at a glance: syntax, data structures, heaps, binary search, recursion and itertools, NumPy and pandas, with costs and practice tasks."
type = "concept"
status = "published"
source = "not from the course: topic list after NeetCode's Python for Coding Interviews, extended; Python 3.12 docs; links to modules 01-03"
chips = [["i-layers", "Reference + practice"], ["i-code", "Python 3.12"]]
+++

Each section below is a compact reference cell with its output, a line or two on what to watch for, and a link to the full lesson where there is one. Then come practice tasks: write your own solution first, then compare. The LeetCode problems at the end of a section are the next step up. Section 16 lists what each operation costs.

## 1. Variables and types

```python title="Notebook cell"
n, name = 0, "Alice"      # assign several names at once
n += 1                    # there is no n++ in Python
a, b = 1, 2
a, b = b, a               # swap without a temporary variable
x = None                  # "no value"
print(n, name, a, b, x)

print(type(n), isinstance(name, str))
label = "even" if n % 2 == 0 else "odd"   # conditional expression
print(label)
print(bool(0), bool(""), bool([]), bool("0"), bool([0]))
```

```output real
1 Alice 2 1 None
<class 'int'> True
odd
False False False True True
```

Empty and zero values count as false, everything else as true, including the string `"0"` and a list holding a `0`. Lessons: [variables and types](lesson:1.2), [conditions](lesson:1.5).

::: practice
**Swap and label.** Start with `a = 7` and `b = 4`. Swap them in one line, then print `big` if `a` is 5 or more, otherwise `small`, with a conditional expression.

```python title="Notebook cell"
a, b = 7, 4
a, b = b, a
print(a, b)
print("big" if a >= 5 else "small")
```

```output real
4 7
small
```
:::

::: practice
**Count the truthy values** in `[0, 1, "", "a", None, [], [0]]`.

```python title="Notebook cell"
values = [0, 1, "", "a", None, [], [0]]
print(sum(1 for v in values if v))
```

```output real
3
```

`if v` keeps the truthy values; `sum(1 for ...)` counts them.
:::

## 2. Numbers and math

```python title="Notebook cell"
print(7 / 2, 7 // 2, 7 % 2)
print(-7 // 2, -7 % 2)      # // rounds down, towards minus infinity
print(int(-7 / 2))          # int() cuts towards zero
print(divmod(17, 5))        # quotient and remainder at once
print(2 ** 10, pow(2, 10, 1000))   # pow with a third argument: modulo
print(abs(-3), round(6.5), round(7.5), round(2.675, 2))
print(2 ** 100)             # ints never overflow
```

```output real
3.5 3 1
-4 1
-3
(3, 2)
1024 24
3 6 8 2.67
1267650600228229401496703205376
```

`//` rounds down, towards minus infinity, and `%` takes the sign of the divisor, so `-7 // 2` is `-4` and `-7 % 2` is `1`, where many languages give `-3` and `-1`. `round()` sends halves to the even neighbour, and `2.675` is stored as slightly less than 2.675, so it rounds down. Lesson: [operators](lesson:1.4).

```python title="Notebook cell"
import math

print(math.floor(2.7), math.ceil(2.1), math.sqrt(16), math.isqrt(17))
print(math.gcd(12, 18), math.lcm(4, 6), math.comb(5, 2))
print(float("inf") > 10 ** 100, -math.inf < -(10 ** 100))
```

```output real
2 3 4.0 4
6 12 10
True True
```

`float("inf")` and `math.inf` are handy starting values for a running minimum or maximum.

```python title="Notebook cell"
x = 0b1011                  # 11 in binary
print(x & 0b0110, x | 0b0100, x ^ 0b1111, x << 1, x >> 1)
print(bin(x), x.bit_count())
```

```output real
2 15 4 22 5
0b1011 3
```

`&` and, `|` or, `^` exclusive or, `<<` and `>>` shift left and right (multiply or divide by 2). `bit_count()` counts the 1 bits.

::: practice
**Digits without strings.** Return the digits of a number as a list, using `divmod` instead of `str()`: `4071` gives `[4, 0, 7, 1]`.

```python title="Notebook cell"
def digits(n):
    result = []
    while n > 0:
        n, d = divmod(n, 10)
        result.append(d)
    return result[::-1] or [0]

print(digits(4071), digits(0))
```

```output real
[4, 0, 7, 1] [0]
```

`divmod(n, 10)` splits off the last digit; `or [0]` covers `n = 0`, where the loop never runs.
:::

::: practice
**Count the 1 bits** of `29` without `bit_count()`.

```python title="Notebook cell"
n, count = 29, 0
while n:
    count += n & 1
    n >>= 1
print(count)
```

```output real
4
```

`n & 1` is the lowest bit; `n >>= 1` drops it. 29 is `0b11101`.
:::

More practice on LeetCode: [Number of 1 Bits](https://leetcode.com/problems/number-of-1-bits/), [Reverse Integer](https://leetcode.com/problems/reverse-integer/).

## 3. Conditions and loops

```python title="Notebook cell"
print(list(range(5)), list(range(2, 6)), list(range(5, 0, -2)))

fruits = ["apple", "banana", "cherry"]
prices = [1.2, 0.5, 3.0]
for i, fruit in enumerate(fruits, start=1):
    print(i, fruit, end="; ")
print()
for fruit, price in zip(fruits, prices):
    print(fruit, price, end="; ")
print()
for fruit in reversed(fruits):
    print(fruit, end=" ")
print()
print(any(p > 2 for p in prices), all(p > 0 for p in prices))
```

```output real
[0, 1, 2, 3, 4] [2, 3, 4, 5] [5, 3, 1]
1 apple; 2 banana; 3 cherry;
apple 1.2; banana 0.5; cherry 3.0;
cherry banana apple
True True
```

`enumerate()` adds a counter, `zip()` walks several sequences together and stops at the shortest, `reversed()` walks backwards without copying.

```python title="Notebook cell"
n = 1
while True:
    n *= 2
    if n > 50:
        break
print(n)

for x in [3, 5, 7]:
    if x % 2 == 0:
        print("found an even number")
        break
else:
    print("no even number")
```

```output real
64
no even number
```

`while True` with a `break` runs until a condition inside says stop. A loop's `else` runs only when no `break` happened. Lessons: [conditions](lesson:1.5), [loops](lesson:1.6).

::: practice
**FizzBuzz.** For 1 to 15, print `Fizz` for multiples of 3, `Buzz` for multiples of 5, `FizzBuzz` for both, and the number otherwise.

```python title="Notebook cell"
for i in range(1, 16):
    if i % 15 == 0:
        print("FizzBuzz", end=" ")
    elif i % 3 == 0:
        print("Fizz", end=" ")
    elif i % 5 == 0:
        print("Buzz", end=" ")
    else:
        print(i, end=" ")
```

```output real
1 2 Fizz 4 Buzz Fizz 7 8 Fizz Buzz 11 Fizz 13 14 FizzBuzz
```

Test for 15 first: a multiple of 15 is also a multiple of 3, and only the first true branch runs.
:::

::: practice
**Best score.** With `names = ["Ana", "Ben", "Cy"]` and `scores = [72, 91, 85]`, print the best score and who got it.

```python title="Notebook cell"
names = ["Ana", "Ben", "Cy"]
scores = [72, 91, 85]
print(max(zip(scores, names)))
```

```output real
(91, 'Ben')
```

Tuples compare item by item, so the pair with the highest score wins.
:::

More practice on LeetCode: [Fizz Buzz](https://leetcode.com/problems/fizz-buzz/).

## 4. Strings

```python title="Notebook cell"
s = "hello world"
print(s[0], s[-1], s[:5], s[::-1])
print(s.upper(), s.title(), s.count("o"), s.find("world"), s.find("xyz"))
print(s.split(), "-".join(["a", "b", "c"]), s.replace("world", "there"))
print(s.startswith("he"), "World".lower() in s, "  pad ".strip())
print("a1".isalnum(), "42".isdigit(), "abc".isalpha())
print(ord("a"), chr(98), ord("c") - ord("a"))
print(int("42") + 1, str(42) + "!")
```

```output real
h d hello dlrow olleh
HELLO WORLD Hello World 2 6 -1
['hello', 'world'] a-b-c hello there
True True pad
True True True
97 b 2
43 42!
```

Strings can't be changed in place: every method returns a new string. `find()` returns `-1` when the text isn't there. `ord(c) - ord("a")` turns a lowercase letter into 0–25, handy as a list index. Lesson: [strings](lesson:1.3).

```python title="Notebook cell"
parts = []
for i in range(5):
    parts.append(str(i))
print("".join(parts))

import string
print(string.ascii_lowercase)
print(f"{3.14159:.2f} {42:>5} {42:05d} {1234567:,}")
```

```output real
01234
abcdefghijklmnopqrstuvwxyz
3.14    42 00042 1,234,567
```

`s += piece` in a loop copies the whole string each time; collect the pieces in a list and `join` once. Format specs: `.2f` two decimals, `>5` right-align in 5 characters, `05d` pad with zeros, `,` thousands separators.

::: practice
**Valid palindrome.** Is `"A man, a plan, a canal: Panama"` a palindrome when you ignore case and everything that isn't a letter or digit?

```python title="Notebook cell"
def is_palindrome(s):
    cleaned = [c.lower() for c in s if c.isalnum()]
    return cleaned == cleaned[::-1]

print(is_palindrome("A man, a plan, a canal: Panama"), is_palindrome("race a car"))
```

```output real
True False
```
:::

::: practice
**Letter counts.** Count the letters of `"banana"` in a list of 26 counters, then print the letters that appear.

```python title="Notebook cell"
counts = [0] * 26
for c in "banana":
    counts[ord(c) - ord("a")] += 1
print({chr(i + ord("a")): n for i, n in enumerate(counts) if n})
```

```output real
{'a': 3, 'b': 1, 'n': 2}
```
:::

::: practice
**Reverse the words** of `"the sky is blue"`.

```python title="Notebook cell"
s = "the sky is blue"
print(" ".join(reversed(s.split())))
```

```output real
blue is sky the
```
:::

More practice on LeetCode: [Valid Palindrome](https://leetcode.com/problems/valid-palindrome/), [Valid Anagram](https://leetcode.com/problems/valid-anagram/), [Reverse Words in a String](https://leetcode.com/problems/reverse-words-in-a-string/).

## 5. Lists

```python title="Notebook cell"
nums = [5, 2, 8, 1]
nums.append(9)          # add at the end: fast
last = nums.pop()       # remove from the end: fast
nums.insert(0, 7)       # insert at the front: slow, shifts every item
print(nums, last, nums[-1], len(nums))

print(sorted(nums), sorted(nums, reverse=True), nums)
nums.sort()
print(nums, min(nums), max(nums), sum(nums))

first, *rest = nums
print(first, rest)
print([0] * 3, nums[1:3], nums[::-1])
print(nums.index(5), 5 in nums, nums.count(5))
```

```output real
[7, 5, 2, 8, 1] 9 1 5
[1, 2, 5, 7, 8] [8, 7, 5, 2, 1] [7, 5, 2, 8, 1]
[1, 2, 5, 7, 8] 1 8 23
1 [2, 5, 7, 8]
[0, 0, 0] [2, 5] [8, 7, 5, 2, 1]
2 True 1
```

A list doubles as a stack: `append` and `pop` work at the end. `sorted()` returns a new list, `sort()` changes the list. Lessons: [lists](lesson:1.7), [list comprehensions](lesson:1.8).

```python title="Notebook cell"
rows, cols = 3, 4
grid = [[0] * cols for _ in range(rows)]
grid[0][1] = 5
print(grid)

bad = [[0] * cols] * rows    # three references to ONE row
bad[0][1] = 5
print(bad)
```

```output real
[[0, 5, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]
[[0, 5, 0, 0], [0, 5, 0, 0], [0, 5, 0, 0]]
```

Build a grid with a comprehension. `[[0] * cols] * rows` repeats a reference to the same inner list, so changing one row changes all of them ([copies](lesson:1.11)). For a real copy: `a[:]` or `list(a)` for one level, `copy.deepcopy(grid)` for nested lists.

```python title="Notebook cell"
directions = [(1, 0), (-1, 0), (0, 1), (0, -1)]
r, c = 0, 0
for dr, dc in directions:
    nr, nc = r + dr, c + dc
    if 0 <= nr < rows and 0 <= nc < cols:
        print((nr, nc), end=" ")
```

```output real
(1, 0) (0, 1)
```

The usual way to visit a cell's neighbours in a grid: a list of moves and a bounds check. `0 <= nr < rows` is a chained comparison.

::: practice
**Running sum.** Turn `[1, 2, 3, 4]` into `[1, 3, 6, 10]`.

```python title="Notebook cell"
def running_sum(nums):
    result, total = [], 0
    for n in nums:
        total += n
        result.append(total)
    return result

print(running_sum([1, 2, 3, 4]))
```

```output real
[1, 3, 6, 10]
```
:::

::: practice
**Best time to buy and sell.** Given daily prices `[7, 1, 5, 3, 6, 4]`, find the largest profit from buying one day and selling on a later day.

```python title="Notebook cell"
def max_profit(prices):
    lowest, best = float("inf"), 0
    for price in prices:
        lowest = min(lowest, price)
        best = max(best, price - lowest)
    return best

print(max_profit([7, 1, 5, 3, 6, 4]), max_profit([7, 6, 4, 3, 1]))
```

```output real
5 0
```

One pass: remember the lowest price so far and the best profit selling today.
:::

::: practice
**Rotate right by k.** Rotate `[1, 2, 3, 4, 5, 6, 7]` by 3 steps to `[5, 6, 7, 1, 2, 3, 4]`.

```python title="Notebook cell"
def rotate(nums, k):
    k %= len(nums)
    return nums[-k:] + nums[:-k]

print(rotate([1, 2, 3, 4, 5, 6, 7], 3), rotate([1, 2], 5))
```

```output real
[5, 6, 7, 1, 2, 3, 4] [2, 1]
```

`k %= len(nums)` handles a `k` larger than the list.
:::

More practice on LeetCode: [Running Sum of 1d Array](https://leetcode.com/problems/running-sum-of-1d-array/), [Best Time to Buy and Sell Stock](https://leetcode.com/problems/best-time-to-buy-and-sell-stock/), [Rotate Array](https://leetcode.com/problems/rotate-array/).

## 6. Tuples

```python title="Notebook cell"
point = (3, 4)
x, y = point
print(x, y, point[0], len(point))
print(type((5,)), type((5)))

visited = {(0, 0), (0, 1)}
print((0, 1) in visited)
distances = {(0, 0): 0, (1, 2): 3}
print(distances[(1, 2)])

def min_max(values):
    return min(values), max(values)

low, high = min_max([4, 9, 1])
print(low, high)
```

```output real
3 4 3 2
<class 'tuple'> <class 'int'>
True
3
1 9
```

Tuples can't change, so they can be set items and dictionary keys, such as `(row, col)` positions. A list can't:

```python title="Notebook cell"
{[1, 2]: "x"}
```

```output real note="last line of the error"
TypeError: unhashable type: 'list'
```

Lesson: [tuples](lesson:1.9).

::: practice
**Count points.** Count how often each point appears in `[(1, 2), (3, 4), (1, 2)]`.

```python title="Notebook cell"
points = [(1, 2), (3, 4), (1, 2)]
counts = {}
for p in points:
    counts[p] = counts.get(p, 0) + 1
print(counts)
```

```output real
{(1, 2): 2, (3, 4): 1}
```
:::

## 7. Sets

```python title="Notebook cell"
seen = set()
seen.add(3)
seen.add(3)
seen.discard(10)           # no error when missing; remove() would raise KeyError
print(seen, 3 in seen, len(seen))

a, b = {1, 2, 3, 4}, {3, 4, 5}
print(a | b, a & b, a - b, a ^ b)
print({x * x for x in range(5)})
print(frozenset({1, 2}) in {frozenset({1, 2})})
```

```output real
{3} True 1
{1, 2, 3, 4, 5} {3, 4} {1, 2} {1, 2, 5}
{0, 1, 4, 9, 16}
True
```

`|`, `&`, `-` and `^` are the operator forms of `union`, `intersection`, `difference` and `symmetric_difference`. `in` on a set takes about the same time at any size. A `frozenset` can't change, so it can go inside another set or be a key. Lesson: [sets](lesson:1.10).

::: practice
**Contains duplicate.** Does `[1, 2, 3, 1]` contain any value twice?

```python title="Notebook cell"
def has_duplicate(nums):
    return len(set(nums)) != len(nums)

print(has_duplicate([1, 2, 3, 1]), has_duplicate([1, 2, 3]))
```

```output real
True False
```
:::

::: practice
**Longest consecutive run.** In `[100, 4, 200, 1, 3, 2]`, find the length of the longest run of consecutive numbers (here 1, 2, 3, 4), in one pass over a set.

```python title="Notebook cell"
def longest_consecutive(nums):
    num_set = set(nums)
    best = 0
    for n in num_set:
        if n - 1 not in num_set:      # n starts a run
            length = 1
            while n + length in num_set:
                length += 1
            best = max(best, length)
    return best

print(longest_consecutive([100, 4, 200, 1, 3, 2]))
```

```output real
4
```

Only numbers that start a run walk forward, so every number is visited a constant number of times.
:::

More practice on LeetCode: [Contains Duplicate](https://leetcode.com/problems/contains-duplicate/), [Longest Consecutive Sequence](https://leetcode.com/problems/longest-consecutive-sequence/).

## 8. Dictionaries, Counter and defaultdict

```python title="Notebook cell"
ages = {"alice": 30, "bob": 25}
ages["carol"] = 35
print(ages.get("dave", 0), "bob" in ages, len(ages))
print(ages.pop("bob"), ages)
ages.setdefault("erin", 40)        # add only if missing
print(ages)

for name, age in ages.items():
    print(name, age, end="; ")
print()
print(max(ages, key=ages.get))
print(sorted(ages.items(), key=lambda kv: kv[1], reverse=True))
```

```output real
0 True 3
25 {'alice': 30, 'carol': 35}
{'alice': 30, 'carol': 35, 'erin': 40}
alice 30; carol 35; erin 40;
erin
[('erin', 40), ('carol', 35), ('alice', 30)]
```

`max(d, key=d.get)` gives the key with the largest value. Lesson: [dictionaries](lesson:1.11).

```python title="Notebook cell"
from collections import Counter, defaultdict, OrderedDict

counts = Counter("mississippi")
print(counts)
print(counts["s"], counts["z"], counts.most_common(2))

groups = defaultdict(list)
for word in ["eat", "tea", "tan", "ate"]:
    groups["".join(sorted(word))].append(word)
print(dict(groups))

cache = OrderedDict(a=1, b=2, c=3)
cache.move_to_end("a")             # "a" is now the most recently used
cache.popitem(last=False)          # drop the least recently used
print(cache)
```

```output real
Counter({'i': 4, 's': 4, 'p': 2, 'm': 1})
4 0 [('i', 4), ('s', 4)]
{'aet': ['eat', 'tea', 'ate'], 'ant': ['tan']}
OrderedDict({'c': 3, 'a': 1})
```

A `Counter` counts anything iterable and returns 0 for missing keys. A `defaultdict(list)` creates an empty list the first time a key is used, so you can `append` straight away; `defaultdict(int)` starts counts at 0. `OrderedDict.move_to_end()` and `popitem(last=False)` are the two moves of a least-recently-used cache.

::: practice
**Two Sum.** Return the positions of the two numbers in `[2, 7, 11, 15]` that add up to `9`, in one pass.

```python title="Notebook cell"
def two_sum(nums, target):
    seen = {}                       # value -> position
    for i, n in enumerate(nums):
        if target - n in seen:
            return [seen[target - n], i]
        seen[n] = i
    return []

print(two_sum([2, 7, 11, 15], 9), two_sum([3, 2, 4], 6))
```

```output real
[0, 1] [1, 2]
```

For each number, the dictionary answers "have I already seen its partner?" in constant time.
:::

::: practice
**Valid anagram.** Are `"listen"` and `"silent"` made of the same letters?

```python title="Notebook cell"
from collections import Counter

def is_anagram(s, t):
    return Counter(s) == Counter(t)

print(is_anagram("listen", "silent"), is_anagram("rat", "car"))
```

```output real
True False
```
:::

::: practice
**Top k frequent.** Return the 2 most frequent values in `[1, 1, 1, 2, 2, 3]`.

```python title="Notebook cell"
from collections import Counter

def top_k_frequent(nums, k):
    return [value for value, _ in Counter(nums).most_common(k)]

print(top_k_frequent([1, 1, 1, 2, 2, 3], 2))
```

```output real
[1, 2]
```
:::

More practice on LeetCode: [Two Sum](https://leetcode.com/problems/two-sum/), [Group Anagrams](https://leetcode.com/problems/group-anagrams/), [Top K Frequent Elements](https://leetcode.com/problems/top-k-frequent-elements/), [LRU Cache](https://leetcode.com/problems/lru-cache/).

## 9. Stacks and queues

```python title="Notebook cell"
stack = []
stack.append(1)
stack.append(2)
print(stack.pop(), stack[-1] if stack else None)

from collections import deque

queue = deque([1, 2, 3])
queue.append(4)            # add on the right
queue.appendleft(0)        # add on the left
print(queue.popleft(), queue.pop(), queue)

recent = deque(maxlen=3)   # keeps only the last 3 items
for x in range(5):
    recent.append(x)
print(recent)
```

```output real
2 1
0 4 deque([1, 2, 3])
deque([2, 3, 4], maxlen=3)
```

Use a list as a stack (last in, first out) and a `deque` as a queue (first in, first out). `list.pop(0)` shifts every item; `deque.popleft()` doesn't.

```python title="Notebook cell"
graph = {"A": ["B", "C"], "B": ["D"], "C": ["D"], "D": []}
order, seen = [], {"A"}
queue = deque(["A"])
while queue:
    node = queue.popleft()
    order.append(node)
    for nxt in graph[node]:
        if nxt not in seen:
            seen.add(nxt)
            queue.append(nxt)
print(order)
```

```output real
['A', 'B', 'C', 'D']
```

The shape of a breadth-first search: a queue of nodes to visit and a set of nodes already queued.

::: practice
**Valid parentheses.** Check that every bracket in a string is closed by the right kind, in the right order: `"([]{})"` is valid, `"(]"` isn't.

```python title="Notebook cell"
def is_valid(s):
    pairs = {")": "(", "]": "[", "}": "{"}
    stack = []
    for ch in s:
        if ch in pairs:
            if not stack or stack.pop() != pairs[ch]:
                return False
        else:
            stack.append(ch)
    return not stack

print(is_valid("([]{})"), is_valid("(]"), is_valid("(("))
```

```output real
True False False
```

Openers go on the stack; each closer must match the latest opener. Anything left over at the end is unclosed.
:::

::: practice
**Moving average.** Print the average of the last 3 values after each of `[4, 8, 6, 2, 10]` arrives.

```python title="Notebook cell"
from collections import deque

window = deque(maxlen=3)
for value in [4, 8, 6, 2, 10]:
    window.append(value)
    print(round(sum(window) / len(window), 2), end=" ")
```

```output real
4.0 6.0 6.0 5.33 6.0
```
:::

More practice on LeetCode: [Valid Parentheses](https://leetcode.com/problems/valid-parentheses/), [Number of Recent Calls](https://leetcode.com/problems/number-of-recent-calls/).

## 10. Heaps

```python title="Notebook cell"
import heapq

heap = []
for x in [5, 1, 8, 3]:
    heapq.heappush(heap, x)
print(heap[0], heap)              # the smallest item is always at index 0
print(heapq.heappop(heap), heap)

nums = [9, 4, 7, 1]
heapq.heapify(nums)               # turn a list into a heap in place
print(nums)

max_heap = []
for x in [5, 1, 8]:
    heapq.heappush(max_heap, -x)  # store negatives for a max-heap
print(-max_heap[0])

tasks = [(2, "write"), (1, "plan"), (3, "test")]
heapq.heapify(tasks)
print(heapq.heappop(tasks))       # tuples compare by their first item
print(heapq.nlargest(2, [5, 1, 8, 3]), heapq.nsmallest(2, [5, 1, 8, 3]))
```

```output real
1 [1, 3, 8, 5]
1 [3, 5, 8]
[1, 4, 7, 9]
8
(1, 'plan')
[8, 5] [1, 3]
```

`heapq` keeps a plain list in heap order: the smallest item first, the rest only partly sorted. Python has no max-heap, so push negated values. Push `(priority, item)` tuples to order by priority.

::: visual heap-as-tree | Run player | A heap is a list
The pushes and the pop from the cell above, shown as the list and as the tree it encodes.
:::

::: practice
**Kth largest.** Find the 2nd largest value in `[3, 2, 1, 5, 6, 4]` with a min-heap that never holds more than k items.

```python title="Notebook cell"
import heapq

def kth_largest(nums, k):
    heap = []
    for n in nums:
        heapq.heappush(heap, n)
        if len(heap) > k:
            heapq.heappop(heap)       # drop the smallest
    return heap[0]

print(kth_largest([3, 2, 1, 5, 6, 4], 2))
```

```output real
5
```

The heap keeps the k largest values seen so far; the smallest of them, at index 0, is the kth largest.
:::

::: practice
**Last stone.** Repeatedly smash the two heaviest stones of `[2, 7, 4, 1, 8, 1]`: equal stones both vanish, otherwise the difference goes back. Return the last stone's weight, or 0.

```python title="Notebook cell"
import heapq

def last_stone_weight(stones):
    heap = [-s for s in stones]
    heapq.heapify(heap)
    while len(heap) > 1:
        first = -heapq.heappop(heap)
        second = -heapq.heappop(heap)
        if first != second:
            heapq.heappush(heap, -(first - second))
    return -heap[0] if heap else 0

print(last_stone_weight([2, 7, 4, 1, 8, 1]))
```

```output real
1
```
:::

More practice on LeetCode: [Kth Largest Element in an Array](https://leetcode.com/problems/kth-largest-element-in-an-array/), [Last Stone Weight](https://leetcode.com/problems/last-stone-weight/).

## 11. Sorting and binary search

```python title="Notebook cell"
words = ["kiwi", "fig", "banana", "apple"]
print(sorted(words))
print(sorted(words, key=len))
print(sorted(words, key=lambda w: (-len(w), w)))   # longest first, then A to Z

people = [("Ana", 31), ("Ben", 25), ("Cy", 31)]
print(sorted(people, key=lambda p: p[1]))          # stable: Ana stays before Cy
```

```output real
['apple', 'banana', 'fig', 'kiwi']
['fig', 'kiwi', 'apple', 'banana']
['banana', 'apple', 'kiwi', 'fig']
[('Ben', 25), ('Ana', 31), ('Cy', 31)]
```

`key=` decides what to compare; a tuple key sorts by several things, and a minus sign reverses one number. Sorting is stable: items that compare equal keep their order.

```python title="Notebook cell"
from operator import itemgetter

# lists of lists: sort rows by their columns
grid = [[3, "c", 9], [1, "b", 5], [3, "a", 2], [2, "d", 7]]
print(sorted(grid))                                      # column 0, then 1, then 2
print(sorted(grid, key=lambda row: row[2]))              # by column 2
print(sorted(grid, key=lambda row: (row[0], -row[2])))   # column 0 up, column 2 down
print(sorted(grid, key=itemgetter(1), reverse=True))     # by column 1, Z to A

matrix = [[3, 1, 2], [9, 7, 8], [6, 5, 4]]
print(sorted(matrix, key=sum))                           # rows by their sum
print([sorted(row) for row in matrix])                   # sort inside each row

points = [(1, 3), (-2, 2), (5, -1), (0, 1)]
print(sorted(points, key=lambda p: p[0] ** 2 + p[1] ** 2))   # nearest to (0, 0) first
```

```output real
[[1, 'b', 5], [2, 'd', 7], [3, 'a', 2], [3, 'c', 9]]
[[3, 'a', 2], [1, 'b', 5], [2, 'd', 7], [3, 'c', 9]]
[[1, 'b', 5], [2, 'd', 7], [3, 'c', 9], [3, 'a', 2]]
[[2, 'd', 7], [3, 'c', 9], [1, 'b', 5], [3, 'a', 2]]
[[3, 1, 2], [6, 5, 4], [9, 7, 8]]
[[1, 2, 3], [7, 8, 9], [4, 5, 6]]
[(0, 1), (-2, 2), (1, 3), (5, -1)]
```

```python title="Notebook cell"
from dataclasses import dataclass
from operator import attrgetter

# objects: sort by their attributes
@dataclass
class Player:
    name: str
    score: int
    age: int

players = [Player("Cy", 90, 30), Player("Ana", 95, 25), Player("Ben", 90, 22)]
print([p.name for p in sorted(players, key=lambda p: p.score)])
# score high to low, then name A to Z
print([p.name for p in sorted(players, key=lambda p: (-p.score, p.name))])
print([p.name for p in sorted(players, key=attrgetter("score", "age"))])
players.sort(key=lambda p: p.age, reverse=True)          # in place, oldest first
print([p.name for p in players])
```

```output real
['Cy', 'Ben', 'Ana']
['Ana', 'Ben', 'Cy']
['Ben', 'Cy', 'Ana']
['Cy', 'Ana', 'Ben']
```

```python title="Notebook cell"
# objects that sort themselves: define <, which sorted, min, max and heapq use
class Job:
    def __init__(self, name, priority):
        self.name = name
        self.priority = priority

    def __lt__(self, other):
        return self.priority < other.priority

    def __repr__(self):
        return f"Job({self.name!r}, {self.priority})"

jobs = [Job("deploy", 3), Job("test", 1), Job("build", 2)]
print(sorted(jobs))
print(min(jobs), max(jobs))

import heapq

heap = []
for job in jobs:
    heapq.heappush(heap, job)
print(heapq.heappop(heap))
```

```output real
[Job('test', 1), Job('build', 2), Job('deploy', 3)]
Job('test', 1) Job('deploy', 3)
Job('test', 1)
```

```python title="Notebook cell"
# ties in a heap: a counter in the middle means the items are never compared
tasks = [(2, "write"), (1, "plan"), (2, "deploy")]
print(sorted(tasks))                         # equal priorities: by name

heap = []
for i, (priority, name) in enumerate(tasks):
    heapq.heappush(heap, (priority, i, name))
print([heapq.heappop(heap)[2] for _ in range(len(heap))])   # equal priorities: by arrival
```

```output real
[(1, 'plan'), (2, 'deploy'), (2, 'write')]
['plan', 'write', 'deploy']
```

```python title="Notebook cell"
# dictionaries, positions and characters
counts = {"b": 2, "a": 2, "c": 5}
print(sorted(counts, key=counts.get, reverse=True))              # keys by value
print(sorted(counts.items(), key=lambda kv: (-kv[1], kv[0])))    # value down, key up

nums = [30, 10, 20]
print(sorted(range(len(nums)), key=lambda i: nums[i]))           # positions in sorted order

print("".join(sorted("banana")), sorted("Banana", key=str.lower))
```

```output real
['c', 'b', 'a']
[('c', 5), ('a', 2), ('b', 2)]
[1, 2, 0]
aaabnn ['a', 'a', 'a', 'B', 'n', 'n']
```

```python title="Notebook cell"
from functools import cmp_to_key

# custom comparison: return negative to put a first, positive for b first, 0 for a tie
def compare(a, b):
    if a + b > b + a:
        return -1
    if a + b < b + a:
        return 1
    return 0

nums = [3, 30, 34, 5, 9]
print("".join(sorted(map(str, nums), key=cmp_to_key(compare))))   # the largest number

# opposite directions on text: sort twice, last key first (sorting is stable)
people = [("Ana", 31), ("Cy", 25), ("Ben", 31), ("Di", 25)]
people.sort(key=lambda p: p[0], reverse=True)   # name, Z to A
people.sort(key=lambda p: p[1])                 # age, low to high
print(people)
```

```output real
9534330
[('Di', 25), ('Cy', 25), ('Ben', 31), ('Ana', 31)]
```

```python title="Notebook cell"
import pandas as pd

# tables: sort a DataFrame by several columns, each in its own direction
df = pd.DataFrame({"name": ["Ana", "Cy", "Ben", "Di"], "age": [31, 25, 31, 25], "score": [88, 92, 95, 79]})
print(df.sort_values(["age", "score"], ascending=[True, False]))   # age up, score down
print(df.nlargest(2, "score"))                                     # the top 2 rows by score
```

```output real
  name  age  score
1   Cy   25     92
3   Di   25     79
2  Ben   31     95
0  Ana   31     88
  name  age  score
2  Ben   31     95
1   Cy   25     92
```

Sorting a table keeps each row's index label ([lesson 3.3](lesson:3.3)).

```python title="Notebook cell"
import bisect

scores = [10, 20, 20, 30]
print(bisect.bisect_left(scores, 20), bisect.bisect_right(scores, 20))
bisect.insort(scores, 25)
print(scores)
```

```output real
1 3
[10, 20, 20, 25, 30]
```

`bisect` finds where a value belongs in a sorted list, so inserting it keeps the order.

```python title="Notebook cell"
def binary_search(nums, target):
    lo, hi = 0, len(nums) - 1
    while lo <= hi:
        mid = (lo + hi) // 2
        if nums[mid] == target:
            return mid
        if nums[mid] < target:
            lo = mid + 1
        else:
            hi = mid - 1
    return -1

print(binary_search([1, 3, 5, 7, 9], 7), binary_search([1, 3, 5, 7, 9], 4))
```

```output real
3 -1
```

Each round halves the search range, so a million items take about 20 rounds.

::: practice
**Search insert position.** Where would each of `5`, `2` and `7` go in `[1, 3, 5, 6]`?

```python title="Notebook cell"
import bisect

nums = [1, 3, 5, 6]
print([bisect.bisect_left(nums, t) for t in (5, 2, 7)])
```

```output real
[2, 1, 4]
```
:::

::: practice
**Merge intervals.** Merge the overlapping intervals in `[[1, 3], [2, 6], [8, 10], [15, 18]]`.

```python title="Notebook cell"
def merge(intervals):
    merged = []
    for start, end in sorted(intervals):
        if merged and start <= merged[-1][1]:
            merged[-1][1] = max(merged[-1][1], end)
        else:
            merged.append([start, end])
    return merged

print(merge([[1, 3], [2, 6], [8, 10], [15, 18]]))
```

```output real
[[1, 6], [8, 10], [15, 18]]
```

After sorting by start, each interval either extends the last merged one or starts a new one.
:::

::: practice
**K closest points.** Return the 2 points of `[[1, 3], [-2, 2], [5, -1], [0, 1]]` closest to the origin.

```python title="Notebook cell"
def k_closest(points, k):
    return sorted(points, key=lambda p: p[0] ** 2 + p[1] ** 2)[:k]

print(k_closest([[1, 3], [-2, 2], [5, -1], [0, 1]], 2))
```

```output real
[[0, 1], [-2, 2]]
```
:::

::: practice
**Sort by frequency.** Rearrange `"tree"` so the most frequent characters come first, ties in alphabetical order.

```python title="Notebook cell"
from collections import Counter

def frequency_sort(s):
    counts = Counter(s)
    return "".join(sorted(s, key=lambda c: (-counts[c], c)))

print(frequency_sort("tree"), frequency_sort("cccaaa"))
```

```output real
eert aaaccc
```
:::

More practice on LeetCode: [Binary Search](https://leetcode.com/problems/binary-search/), [Search Insert Position](https://leetcode.com/problems/search-insert-position/), [Merge Intervals](https://leetcode.com/problems/merge-intervals/), [K Closest Points to Origin](https://leetcode.com/problems/k-closest-points-to-origin/), [Sort Characters By Frequency](https://leetcode.com/problems/sort-characters-by-frequency/), [Largest Number](https://leetcode.com/problems/largest-number/).

## 12. Functions and recursion

```python title="Notebook cell"
def greet(name, greeting="Hello", *args, **kwargs):
    return f"{greeting}, {name}!", args, kwargs

print(greet("Alice"))
print(greet("Bob", "Hi", 1, 2, mood="happy"))

def make_counter():
    count = 0
    def increment():
        nonlocal count        # rebind the outer function's variable
        count += 1
        return count
    return increment

tick = make_counter()
print(tick(), tick(), tick())
```

```output real
('Hello, Alice!', (), {})
('Hi, Bob!', (1, 2), {'mood': 'happy'})
1 2 3
```

An inner function can read the outer function's variables; to assign to one, declare it `nonlocal`. Lessons: [functions](lesson:1.12), [lambda](lesson:1.14), [closures and decorators](lesson:2.8).

```python title="Notebook cell"
count = 0

def bump():
    global count          # assign to the module-level name, not a new local one
    count += 1

bump()
bump()
print(count)
```

```output real
2
```

`global` does the same for a name defined at the top of the module ([lesson 3.11](lesson:3.11)). Without it, `count += 1` raises `UnboundLocalError`: assigning makes `count` a local variable.

```python title="Notebook cell"
def add_item(item, items=[]):        # the default list is created once
    items.append(item)
    return items

print(add_item(1), add_item(2))

def add_item_fixed(item, items=None):
    if items is None:
        items = []
    items.append(item)
    return items

print(add_item_fixed(1), add_item_fixed(2))
```

```output real
[1, 2] [1, 2]
[1] [2]
```

A default value is created once, when `def` runs, so a mutable default is shared by every call. Use `None` and create the list inside.

```python title="Notebook cell"
from functools import cache

@cache
def fib(n):
    return n if n < 2 else fib(n - 1) + fib(n - 2)

print(fib(80))
```

```output real
23416728348467685
```

`@cache` remembers every result, turning this exponential recursion into a linear one. Deep recursion stops at about 1,000 nested calls (`sys.setrecursionlimit()` raises the limit); for deeper problems, use a loop.

```python title="Notebook cell"
import functools

def logged(func):
    @functools.wraps(func)                 # keep func's name and docstring
    def wrapper(*args, **kwargs):
        result = func(*args, **kwargs)
        print(f"{func.__name__}{args} -> {result}")
        return result                      # pass the result on
    return wrapper                         # the function, not wrapper()

@logged                                    # add = logged(add)
def add(a, b):
    return a + b

add(2, 3)
print(add.__name__)
```

```output real
add(2, 3) -> 5
add
```

The decorator template. With arguments, `@repeat(3)` means `f = repeat(3)(f)`: one more function around this one ([decorators](lesson:2.8)).

::: practice
**Climbing stairs.** You climb 1 or 2 steps at a time. How many ways are there to climb 5 steps?

```python title="Notebook cell"
from functools import cache

@cache
def climb(n):
    if n <= 2:
        return n
    return climb(n - 1) + climb(n - 2)

print(climb(5), climb(30))
```

```output real
8 1346269
```

The last move was either 1 step or 2 steps, so the ways to reach `n` are the ways to reach `n - 1` plus the ways to reach `n - 2`.
:::

::: practice
**Flatten.** Flatten `[1, [2, [3, 4]], 5]` into `[1, 2, 3, 4, 5]` with recursion.

```python title="Notebook cell"
def flatten(items):
    result = []
    for item in items:
        if isinstance(item, list):
            result.extend(flatten(item))
        else:
            result.append(item)
    return result

print(flatten([1, [2, [3, 4]], 5]))
```

```output real
[1, 2, 3, 4, 5]
```
:::

More practice on LeetCode: [Climbing Stairs](https://leetcode.com/problems/climbing-stairs/), [Fibonacci Number](https://leetcode.com/problems/fibonacci-number/).

## 13. Iteration tools

```python title="Notebook cell"
from itertools import (accumulate, chain, combinations, groupby, pairwise,
                       permutations, product)

print(list(accumulate([1, 2, 3, 4])))        # running totals
print(list(combinations("abc", 2)))
print(list(permutations([1, 2, 3], 2)))
print(list(product([0, 1], repeat=2)))
print(list(pairwise([1, 4, 9])))
print([(key, len(list(group))) for key, group in groupby("aaabcc")])
print(list(chain([1, 2], [3])))
```

```output real
[1, 3, 6, 10]
[('a', 'b'), ('a', 'c'), ('b', 'c')]
[(1, 2), (1, 3), (2, 1), (2, 3), (3, 1), (3, 2)]
[(0, 0), (0, 1), (1, 0), (1, 1)]
[(1, 4), (4, 9)]
[('a', 3), ('b', 1), ('c', 2)]
[1, 2, 3]
```

`combinations` ignores order, `permutations` respects it, and `product` is a nested loop. `groupby` groups *neighbouring* equal items, so sort first when equal items aren't next to each other.

```python title="Notebook cell"
def countdown(n):                 # a generator: yield pauses here
    while n > 0:
        yield n
        n -= 1

gen = countdown(3)
print(next(gen), list(gen), next(gen, "done"))

it = iter([10, 20])               # any iterable -> iterator
print(next(it), next(it), next(it, None))
print(sum(x * x for x in range(4)))   # generator expression, no list built
```

```output real
3 [2, 1] done
10 20 None
14
```

A generator or iterator makes one pass; `next(it, default)` avoids `StopIteration`. A class becomes iterable with `__iter__` and `__next__` ([iterators](lesson:2.6), [generators](lesson:2.7)).

::: practice
**All subsets** of `[1, 2, 3]`, from the empty one to the full one.

```python title="Notebook cell"
from itertools import combinations

nums = [1, 2, 3]
subsets = [list(c) for size in range(len(nums) + 1) for c in combinations(nums, size)]
print(subsets)
```

```output real
[[], [1], [2], [3], [1, 2], [1, 3], [2, 3], [1, 2, 3]]
```
:::

::: practice
**Range sums.** For `nums = [-2, 0, 3, -5, 2, -1]`, answer "sum from position i to j" in constant time with prefix sums: (0, 2), (2, 5) and (0, 5).

```python title="Notebook cell"
from itertools import accumulate

nums = [-2, 0, 3, -5, 2, -1]
prefix = [0] + list(accumulate(nums))

def range_sum(i, j):
    return prefix[j + 1] - prefix[i]

print(range_sum(0, 2), range_sum(2, 5), range_sum(0, 5))
```

```output real
1 -1 -3
```

`prefix[k]` is the sum of the first `k` numbers, so any range is one subtraction.
:::

More practice on LeetCode: [Subsets](https://leetcode.com/problems/subsets/), [Range Sum Query - Immutable](https://leetcode.com/problems/range-sum-query-immutable/).

## 14. Classes

```python title="Notebook cell"
class Stack:
    def __init__(self):
        self.items = []

    def push(self, item):
        self.items.append(item)

    def pop(self):
        return self.items.pop()

    def __len__(self):
        return len(self.items)

    def __repr__(self):
        return f"Stack({self.items})"

s = Stack()
s.push(1)
s.push(2)
print(s, len(s))
print(s.pop(), s)
```

```output real
Stack([1, 2]) 2
2 Stack([1])
```

`__init__` sets up a new object; every method takes `self`, the object itself. `__len__` makes `len()` work and `__repr__` controls how the object prints. Lessons: [classes](lesson:2.1), [magic methods](lesson:2.5).

```python title="Notebook cell"
class Animal:
    def __init__(self, name):
        self.name = name

    def speak(self):
        return "..."

    def __repr__(self):
        return f"{type(self).__name__}({self.name!r})"

class Dog(Animal):
    def __init__(self, name, tricks=0):
        super().__init__(name)           # never implicit
        self.tricks = tricks

    def speak(self):                     # override
        return "Woof"

    @property
    def trained(self):                   # read like an attribute
        return self.tricks > 0

d = Dog("Rex", tricks=2)
print(d, d.speak(), d.trained, isinstance(d, Animal))
print([c.__name__ for c in Dog.__mro__])
```

```output real
Dog('Rex') Woof True True
['Dog', 'Animal', 'object']
```

Lessons: [inheritance](lesson:2.2), [properties](lesson:2.4).

```python title="Notebook cell"
from abc import ABC, abstractmethod

class Shape(ABC):
    @abstractmethod
    def area(self): ...

class Square(Shape):
    def __init__(self, side):
        self.side = side

    def area(self):
        return self.side ** 2

    def __eq__(self, other):             # ==
        return self.side == other.side

    def __hash__(self):                  # needed again once __eq__ exists
        return hash(self.side)

    def __lt__(self, other):             # <, sorted, min, heapq
        return self.side < other.side

shapes = [Square(3), Square(1), Square(2)]
print([s.side for s in sorted(shapes)], Square(2) == Square(2), len({Square(2), Square(2)}))

class ShapeError(Exception):             # your own exception type
    pass

try:
    Shape()
except TypeError as e:
    print(e)
```

```output real
[1, 2, 3] True 1
Can't instantiate abstract class Shape without an implementation for abstract method 'area'
```

Lessons: [abstract classes](lesson:2.3), [magic methods](lesson:2.5), [exception classes](lesson:2.2).

```python title="Notebook cell"
from dataclasses import dataclass, field

@dataclass(order=True)
class Task:
    priority: int
    name: str = field(compare=False)

tasks = [Task(2, "write"), Task(1, "plan")]
print(min(tasks))
print(sorted(tasks)[0].name)
```

```output real
Task(priority=1, name='plan')
plan
```

`@dataclass` writes `__init__`, `__repr__` and comparisons for you; `order=True` makes objects sortable by their fields, which is what a heap needs. Lesson: [dataclasses](lesson:4.1).

```python title="Notebook cell"
class ListNode:
    def __init__(self, val=0, next=None):
        self.val = val
        self.next = next

class TreeNode:
    def __init__(self, val=0, left=None, right=None):
        self.val = val
        self.left = left
        self.right = right

head = ListNode(1, ListNode(2, ListNode(3)))
node, values = head, []
while node:
    values.append(node.val)
    node = node.next
print(values)

root = TreeNode(2, TreeNode(1), TreeNode(3))
print(root.left.val, root.val, root.right.val)
```

```output real
[1, 2, 3]
1 2 3
```

These two shapes are what linked-list and tree problems hand you.

::: practice
**Reverse a linked list** `1 → 2 → 3` in place.

```python title="Notebook cell"
def reverse_list(head):
    prev = None
    while head:
        head.next, prev, head = prev, head, head.next
    return prev

node, values = reverse_list(ListNode(1, ListNode(2, ListNode(3)))), []
while node:
    values.append(node.val)
    node = node.next
print(values)
```

```output real
[3, 2, 1]
```

Each step points the current node back at the previous one. The tuple assignment evaluates the right side first, so no value is lost.
:::

::: practice
**Min stack.** Write a stack whose `get_min()` returns the smallest item in constant time.

```python title="Notebook cell"
class MinStack:
    def __init__(self):
        self.items = []
        self.mins = []           # mins[-1] is the minimum of items

    def push(self, x):
        self.items.append(x)
        self.mins.append(min(x, self.mins[-1]) if self.mins else x)

    def pop(self):
        self.mins.pop()
        return self.items.pop()

    def get_min(self):
        return self.mins[-1]

stack = MinStack()
for x in [5, 2, 7]:
    stack.push(x)
print(stack.get_min())
stack.pop()
stack.pop()
print(stack.get_min())
```

```output real
2
5
```

A second stack stores the minimum at every height, so popping restores the previous minimum.
:::

More practice on LeetCode: [Reverse Linked List](https://leetcode.com/problems/reverse-linked-list/), [Min Stack](https://leetcode.com/problems/min-stack/), [Maximum Depth of Binary Tree](https://leetcode.com/problems/maximum-depth-of-binary-tree/).

## 15. NumPy and pandas

```python title="Notebook cell"
import numpy as np

a = np.array([[1, 2, 3], [4, 5, 6]])
print(a.shape, a.ndim, a.dtype)                   # (rows, columns), axes, element type
print(a * 10)                                     # element by element
print(a[:, 1], a[1, 1:])                          # column 1; row 1 from column 1
print(a[a > 2])                                   # a mask keeps the values where it is True
print(a.sum(), a.sum(axis=0), a.mean(axis=1))     # all; per column (down axis 0); per row
print(np.arange(6).reshape(3, 2).tolist())
```

```output real
(2, 3) 2 int64
[[10 20 30]
 [40 50 60]]
[2 5] [5 6]
[3 4 5 6]
21 [5 7 9] [2. 5.]
[[0, 1], [2, 3], [4, 5]]
```

Combine masks with `&`, `|` and `~`, each comparison in brackets. A slice of an array is a view: writing to it changes the array. Lesson: [NumPy arrays](lesson:3.1).

```python title="Notebook cell"
import pandas as pd

df = pd.DataFrame({"name": ["Ana", "Ben", "Cy", "Di"],
                   "team": ["red", "blue", "red", "blue"],
                   "score": [88, 92, None, 75]})
print(df["score"].isnull().sum())                     # missing values in a column
df["score"] = df["score"].fillna(df["score"].mean())
print(df.loc[0, "name"], df.iloc[-1]["name"])         # by label, by position
print(df[(df["score"] > 80) & (df["team"] == "red")])  # filter rows
print(df.groupby("team")["score"].agg(["mean", "count"]))

teams = pd.DataFrame({"team": ["red", "blue"], "coach": ["Eve", "Max"]})
print(pd.merge(df, teams, on="team", how="left"))      # a SQL-style join
```

```output real
1
Ana Di
  name team  score
0  Ana  red   88.0
2   Cy  red   85.0
      mean  count
team
blue  83.5      2
red   86.5      2
  name  team  score coach
0  Ana   red   88.0   Eve
1  Ben  blue   92.0   Max
2   Cy   red   85.0   Eve
3   Di  blue   75.0   Max
```

`loc` takes row labels, `iloc` positions; they part ways once rows are dropped or sorted. Each operation returns a new DataFrame unless you assign it back. Read and write with `pd.read_csv(path)` and `df.to_csv(path, index=False)`. Lessons: [Series and DataFrames](lesson:3.2), [cleaning and grouping](lesson:3.3), [files and formats](lesson:3.4).

::: practice
**Normalise scores.** For the scores `[70, 85, 90, 55, 100]`, print the z-scores rounded to two decimals, then the scores above the mean.

```python title="Notebook cell"
import numpy as np

scores = np.array([70, 85, 90, 55, 100])
z = (scores - scores.mean()) / scores.std()
print(np.round(z, 2))
print(scores[scores > scores.mean()])
```

```output real
[-0.63  0.32  0.63 -1.58  1.26]
[ 85  90 100]
```

The arithmetic runs on every element at once; the mask compares each score with the mean.
:::

::: practice
**Best seller per region.** From the table below, total the units per region and product, then keep the best-selling product of each region.

```python title="Notebook cell"
import pandas as pd

sales = pd.DataFrame({"region": ["East", "East", "West", "West", "West"],
                      "product": ["pen", "ink", "pen", "pen", "ink"],
                      "units": [5, 3, 2, 4, 7]})
totals = sales.groupby(["region", "product"])["units"].sum().reset_index()
print(totals)
best = totals.sort_values("units", ascending=False).groupby("region").head(1)   # first row of each region
print(best.sort_values("region"))
```

```output real
  region product  units
0   East     ink      3
1   East     pen      5
2   West     ink      7
3   West     pen      6
  region product  units
1   East     pen      5
2   West     ink      7
```

`reset_index()` turns the two group keys back into columns; after sorting by units, the first row of each region is its best seller.
:::

## 16. What each operation costs

`n` is the number of items. O(1) takes the same time at any size, O(n) grows with the size, O(log n) grows very slowly.

| Operation | Cost |
|---|---|
| list: `a[i]`, `a[i] = x`, `a.append(x)`, `a.pop()`, `len(a)` | O(1) |
| list: `a.insert(0, x)`, `a.pop(0)`, `x in a`, `a.index(x)`, `a.remove(x)` | O(n) |
| list: `a.sort()`, `sorted(a)` | O(n log n) |
| list: `a[i:j]` | O(j − i) |
| set: `x in s`, `s.add(x)`, `s.discard(x)` | O(1) on average |
| dict: `d[k]`, `d[k] = v`, `k in d`, `d.pop(k)` | O(1) on average |
| deque: `append`, `appendleft`, `pop`, `popleft` | O(1) |
| heap: `h[0]` | O(1) |
| heap: `heappush`, `heappop` | O(log n) |
| heap: `heapify` | O(n) |
| `bisect_left`, `bisect_right` | O(log n) |
| `bisect.insort` | O(n), for the insert |
| str: `s + t`, `s[i:j]` | O(length of the result) |
| str: `x in s`, `s.find(x)`, `s.replace(a, b)` | O(n), typically |
| str: `"".join(parts)` | O(total length) |
