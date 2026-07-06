# Simple dice roll EV calculator
Website link: []()
- Mainly meant for DND-style attack roll and damage calculations
- You can also run `calc.py` from the command line with the same syntax as in the browser app
    - run `python calc.py -h` for info

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
- `adv` - Advantage: takes the maximum of two rolls
- `disadv` - Disadvantage: takes the minimum of two rolls

## Unary Operators (apply to one value)
- `-` - Negation (multiply by -1)

## Examples
- `d20` - Roll a 20-sided die
- `2d6 + 5` - Roll two 6-sided dice and add 5
- `d20 adv d20 + 5` - Roll d20 with advantage and add 5
- `(d20 >= 15)` - Check if d20 roll is 15 or higher (1 for success, 0 for failure)
- `(d20 adv d20 + 5 >= 15) * (2d6 + 5)` - Attack roll (d20) with advantage, with attack bonus + 5, against AC 15, causing 2d6 + 5 damage on hit.
- `(d20 + 5 >= 15) * (2d6 + 5) + (d20 + 5 >= 15) * (1d4 + 5)` - Two attack rolls, both against the same AC and with the same attack bonuses, but with different damage values.

# Installation
If you want to run it locally, simply create a venv and install the modules from requirements.txt
```sh
python -m pip venv
source venv/bin/activate # For windows, run the activation script in venv/Scripts/
python -m pip install -r requirements.txt
```

- Running from command line
```sh
python calc.py "2d6 + 5"
```