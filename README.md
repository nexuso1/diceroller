# Simple dice roll EV calculator
**Run it online** []()

Self-explanatory, mainly meant for DND-style attack roll and damage calculations
- You can also run `calc.py` from the command line with the same syntax as in the browser app
    - run `python calc.py -h` for info

## Usage Guide
The output of the program is the expected value computed from the dice expression, along with median and standard deviation. It uses simulations to evaluate the expression, so expect slight inaccuracies.
- You can increase the number of simulations the argument `--trials`

You can either use the website or run locally.

#### Example 1
```sh
python calc.py "(2d6 + 5)"
```
Outputs:
```
Expression: (2d6 + 5)
Trials: 200000
Expected value: 12.004
Median value: 12.000
Standard deviation (bias corrected): 2.421
```
#### Example 2
```sh
python calc.py "(2d6 + 5)" -v 0 --seed 42
```
Outputs:
```
11.998015
```

### Binary Operators (combine two values)
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
- `adv` - Advantage: takes the maximum of two rolls
- `disadv` - Disadvantage: takes the minimum of two rolls

### Unary Operators (apply to one value)
- `-` - Negation (multiply by -1)

### Examples
- `d20` - Roll a 20-sided die
- `2d6 + 5` - Roll two 6-sided dice and add 5
- `d20 adv d20 + 5` - Roll d20 with advantage and add 5
- `(d20 >= 15)` - Check if d20 roll is 15 or higher (1 for success, 0 for failure)
- `(d20 adv d20 + 5 >= 15) * (2d6 + 5)` - Attack roll (d20) with advantage, with attack bonus + 5, against AC 15, causing 2d6 + 5 damage on hit.
- `(d20 + 5 >= 15) * (2d6 + 5) + (d20 + 5 >= 15) * (1d4 + 5)` - Two attack rolls, both against the same AC and with the same attack bonuses, but with different damage values.

## Installation
If you want to run it locally, simply create a venv and install the modules from requirements.txt
```sh
python -m pip venv
source venv/bin/activate # For windows, run the activation script in venv/Scripts/
python -m pip install -r requirements.txt
```