import argparse
import re
import sys

import numpy as np

from operators import DiceRoll, Number, operator_registry

TOKEN_RE = re.compile(r"\s*([a-z]+|\d+|>=|<=|!=|==|[<>+\-*/()])")


class ParseError(Exception):
    pass


def tokenize(expr):
    tokens = TOKEN_RE.findall(expr)
    joined = "".join(tokens)
    if joined != expr.replace(" ", ""):
        raise ParseError(f"Invalid token in expression: {expr}")
    return tokens


def parse(expr):
    tokens = tokenize(expr)
    pos = 0

    def peek():
        return tokens[pos] if pos < len(tokens) else None

    def advance():
        nonlocal pos
        token = peek()
        pos += 1
        return token

    def parse_expression(rbp=0):
        token = advance()
        if token is None:
            raise ParseError("Unexpected end of expression")

        left = parse_nud(token)

        while True:
            op = peek()
            if op is None or op == ")":
                break
            try:
                precedence = operator_registry.get_binary(op).precedence
            except KeyError:
                precedence = None
            if precedence is None or precedence <= rbp:
                break
            advance()
            left = parse_led(op, left)

        return left

    def parse_nud(token):
        if token in "+-":
            unary_cls = operator_registry.get_unary(token)
            return unary_cls(parse_expression(100))
        if token == "d":
            dice_cls = operator_registry.get_binary("d")
            right = parse_expression(dice_cls.precedence)
            return dice_cls(Number(1), right)
        if token == "(":
            expr_value = parse_expression()
            if advance() != ")":
                raise ParseError("Missing closing parenthesis")
            return expr_value
        if token.endswith("d"):
            raise ParseError(f"Invalid dice expression: {token}")
        if "d" in token:
            count_str, sides_str = token.split("d")
            count = int(count_str) if count_str else 1
            sides = int(sides_str)
            if count < 1 or sides < 1:
                raise ParseError(f"Invalid dice expression: {token}")
            return DiceRoll(count, sides)
        if token.isdigit():
            return Number(token)

        raise ParseError(f"Unexpected token: {token}. Make sure that operators and variable names are specified correctly in the expression.")

    def parse_led(op, left):
        operator_cls = operator_registry.get_binary(op)
        right = parse_expression(operator_cls.precedence)
        return operator_cls(left, right)

    result = parse_expression()
    if peek() is not None:
        raise ParseError(f"Unexpected token after expression: {peek()}")
    return result


def evaluate_expression(expr, trials=200_000, seed=None):
    rng = np.random.default_rng(seed)
    evaluator = parse(expr)
    return evaluator(rng, trials)

def simulate_distribution(expr, trials=200_000, seed=None):
    rng = np.random.default_rng(seed)
    evaluator = parse(expr)
    return evaluator(rng, trials)

def main(argv=None):
    parser = argparse.ArgumentParser(description="Evaluate dice expression expected value by Monte Carlo simulation.")
    parser.add_argument("expression", nargs="+", help="Dice expression to evaluate")
    parser.add_argument("--trials", type=int, default=200_000, help="Number of simulations to run")
    parser.add_argument("--seed", type=int, default=None, help="RNG seed for reproducibility")
    parser.add_argument("-v", "--verbosity", type=int, default=1, help="Verbosity. Set to 0 to only write the expected value.")
    args = parser.parse_args(argv)
    expression = " ".join(args.expression)

    try:
        values = evaluate_expression(expression, trials=args.trials, seed=args.seed)
    except ParseError as exc:
        print(f"Error: {exc}", file=sys.stderr)
        return 1
    if args.verbosity > 0:
        print(f"Expression: {expression}")
        print(f"Trials: {args.trials}")
        print(f"Expected value: {np.mean(values):.3f}")
        print(f"Median value: {np.median(values):.3f}")
        print(f"Standard deviation (bias corrected): {np.std(values, ddof=1):.3f}")
    else:
        print(np.mean(values))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
