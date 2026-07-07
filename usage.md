# Usage Guide

1. Write an expression you would like to evaluate to the input box
2. Click `Simulate` (Hotkey = `S`)

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
- `((d20 max d20 + n - 5 >= k) * (2d6 + 5 + 10)) > ((d20 max d20 + n >= k) * (2d6 + 5 ))` Comparison between attacks with Heavy Weapon Master(HWM) and without. `n` is the base attack bonus, and `k` is the AC. The median matrix will have `1` on the positions where the HWM attack deals more damage on average. Use variables to set different values for `n` and `k`.

## Variables
Allow you to evalute the expression for multiple values at the same time. Currently, up to two variables are supported.
Each variable has
- Name
  - string that you can write inside the expression
- Value
  - set of values that the variable can have.

Inside the dice expression, each instance of name will be substituted for one value from the set (each instance of variable `x` will get the same value assignment in a single experiment), and 
then the experiment is run. We test every possible combination of value assignments and then report the results in a table.

### Example

For example, we would like to see how much damage we can do against multiple AC variants at the same time. Our attack and damage rolls looks like
```sh
# Attack roll
d20 + 7 + d4

# Damage roll
2d6 + 4
```
We have
- +7 attack bonus
- Buff that adds 1d4 to our hit rolls
- We deal `2d6 + 4` damage on hit

We want to see how we fare against foes with some reasonable AC values, e.g. $\text{AC} \in \set{10, 11,  ... , 20}$. We can use a variable for the AC. 
1. Click on the `Add Variable` button
2. Set name to `AC`
3. Set values to `10-20`

Now we can write a dice expression using the variable.
```
(d20 + 7 + d4 >= AC) * (2d6 + 4)
```
Now, when we press `Simulate`, we will run many experiments, substituting `AC` in the expression for each possible value in the value set of the variable `AC`. In the summary column, we will get a table with the results, one row for each value of `AC`.

If we would like to evaluate multiple attack bonuses, we can use another variable, e.g. `n` with values set to `5-9`, and rewrite the expression to
```
(d20 + n + d4 >= AC) * (2d6 + 4)
```
