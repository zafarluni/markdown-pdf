# Reading a small program

The code sample should be legible, keep its indentation, and wrap long lines without clipping.

## A loop with an accumulator

```python
def squares_total(values):
    total = 0
    for value in values:
        total += value * value
    return total
```

The loop updates `total` once per input value. Its running time grows linearly with the number of values.

## Checklist

- [x] Give the function a descriptive name.
- [x] Explain the result.
- [ ] Try an empty list and a list containing negative numbers.

## A long technical line

```text
This_is_a_deliberately_long_identifier_or_URL_like_token_that_should_wrap_inside_the_printable_area_instead_of_being_clipped_at_the_right_edge_of_the_page_1234567890
```
