# Usage Guide
## Binary Operators (combine two values)
- `d` - Dice roll: `NdS` rolls N dice with S sides
- `+` - Addition
- `-` - Subtraction
- `*` - Multiplication
- `/` - Division
- `>` - Greater than (returns 1 if true, 0 if false)
- `<` - Less than (returns 1 if true, 0 if false)
- `>=` - Greater than or equal (returns 1 if true, 0 if false)
- `<=` - Less than or equal (returns 1 if true, 0 if false)
- `==` - Equal (returns 1 if true, 0 if false)
- `!=` - Not equal (returns 1 if true, 0 if false)
- `max` - Maximum: takes the maximum of two values (e.g for Advantage)
- `min` - Minimum: takes the minimum of two values (e.g. for Disadvantage)

## Unary Operators (apply to one value)
- `-` - Negation (multiply by -1)

## Examples
- `d20` - Roll a 20-sided die
- `2d6 + 5` - Roll two 6-sided dice and add 5
- `d20 max d20 + 5` - Roll d20 with advantage and add 5
- `(d20 >= 15)` - Check if d20 roll is 15 or higher (1 for success, 0 for failure)
- `(d20 max d20 + 5 >= 15) * (2d6 + 5)` - Attack roll (d20) with advantage, with attack bonus + 5, against AC 15, causing 2d6 + 5 damage on hit.
- `(d20 + 5 >= 15) * (2d6 + 5) + (d20 + 5 >= 15) * (1d4 + 5)` - Two attack rolls, both against the same AC and with the same attack bonuses, but with different damage values.
- `((d20 max d20 + n - 5 >= k) * (2d6 + 5 + 10)) > ((d20 max d20 + n >= k) * (2d6 + 5 ))` Comparison between attacks with Heavy Weapon Master(HWM) and without. `n` is the base attack bonus, and `k` is the AC. The median matrix will have `1` on the positions where the HWM attack deals more damag on average. Use variables to set different values for `n` and `k`.