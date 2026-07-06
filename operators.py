import inspect
import numpy as np


class Operator:
    token = None
    precedence = None

    def __call__(self, *args, **kwds):
        return self.evaluate(*args, **kwds)

    def evaluate(self, rng, trials):
        raise NotImplementedError("Operator subclasses must implement evaluate")


class Registry:
    def __init__(self):
        self.binary_operators = {}
        self.unary_operators = {}

    def register_binary(self, token, operator_cls):
        self.binary_operators[token] = operator_cls

    def register_unary(self, token, operator_cls):
        self.unary_operators[token] = operator_cls

    def get_binary(self, token):
        try:
            return self.binary_operators[token]
        except KeyError:
            raise KeyError(f"Unknown binary operator: {token}")

    def get_unary(self, token):
        try:
            return self.unary_operators[token]
        except KeyError:
            raise KeyError(f"Unknown unary operator: {token}")


operator_registry = Registry()


class Number(Operator):
    def __init__(self, value):
        self.value = float(value)

    def evaluate(self, rng, trials):
        return np.full(trials, self.value, dtype=np.float64)


class UnaryOperator(Operator):
    def __init__(self, operand: Operator):
        self.operand: Operator = operand


class UnaryPlus(UnaryOperator):
    token = "+"
    precedence = 90

    def evaluate(self, rng, trials):
        return self.operand.evaluate(rng, trials)


class Negate(UnaryOperator):
    token = "-"
    precedence = 90

    def evaluate(self, rng, trials):
        return -self.operand.evaluate(rng, trials)


class BinaryOperator(Operator):
    def __init__(self, left: Operator, right: Operator):
        self.left = left
        self.right = right


class DiceRoll(BinaryOperator):
    token = "d"
    precedence = 101

    def evaluate(self, rng, trials):
        count_values = self.left.evaluate(rng, trials).astype(np.int64)
        sides_values = self.right.evaluate(rng, trials).astype(np.int64)

        if np.all(count_values == count_values[0]) and np.all(sides_values == sides_values[0]):
            count = int(count_values[0])
            sides = int(sides_values[0])
            if count < 1 or sides < 1:
                raise ValueError("Dice count and sides must be positive")
            if count == 1:
                return rng.integers(1, sides + 1, size=trials, dtype=np.int64).astype(np.float64)
            rolls = rng.integers(1, sides + 1, size=(trials, count), dtype=np.int64).astype(np.float64)
            return rolls.sum(axis=1)

        results = np.empty(trials, dtype=np.float64)
        for i in range(trials):
            count = int(count_values[i])
            sides = int(sides_values[i])
            if count < 1 or sides < 1:
                raise ValueError("Dice count and sides must be positive")
            results[i] = rng.integers(1, sides + 1, size=count, dtype=np.int64).astype(np.float64).sum()
        return results


class Add(BinaryOperator):
    token = "+"
    precedence = 20

    def evaluate(self, rng, trials):
        return self.left.evaluate(rng, trials) + self.right.evaluate(rng, trials)


class Subtract(BinaryOperator):
    token = "-"
    precedence = 20

    def evaluate(self, rng, trials):
        return self.left.evaluate(rng, trials) - self.right.evaluate(rng, trials)


class Multiply(BinaryOperator):
    token = "*"
    precedence = 30

    def evaluate(self, rng, trials):
        return self.left.evaluate(rng, trials) * self.right.evaluate(rng, trials)


class Divide(BinaryOperator):
    token = "/"
    precedence = 30

    def evaluate(self, rng, trials):
        return self.left.evaluate(rng, trials) / self.right.evaluate(rng, trials)


class Greater(BinaryOperator):
    token = ">"
    precedence = 10

    def evaluate(self, rng, trials):
        return (self.left.evaluate(rng, trials) > self.right.evaluate(rng, trials)).astype(np.float64)


class Less(BinaryOperator):
    token = "<"
    precedence = 10

    def evaluate(self, rng, trials):
        return (self.left.evaluate(rng, trials) < self.right.evaluate(rng, trials)).astype(np.float64)


class GreaterEqual(BinaryOperator):
    token = ">="
    precedence = 10

    def evaluate(self, rng, trials):
        return (self.left.evaluate(rng, trials) >= self.right.evaluate(rng, trials)).astype(np.float64)


class LessEqual(BinaryOperator):
    token = "<="
    precedence = 10

    def evaluate(self, rng, trials):
        return (self.left.evaluate(rng, trials) <= self.right.evaluate(rng, trials)).astype(np.float64)


class Equal(BinaryOperator):
    token = "=="
    precedence = 10

    def evaluate(self, rng, trials):
        return (self.left.evaluate(rng, trials) == self.right.evaluate(rng, trials)).astype(np.float64)


class NotEqual(BinaryOperator):
    token = "!="
    precedence = 10

    def evaluate(self, rng, trials):
        return (self.left.evaluate(rng, trials) != self.right.evaluate(rng, trials)).astype(np.float64)


class Advantage(BinaryOperator):
    token = "adv"
    precedence = 100

    def evaluate(self, rng, trials):
        return np.maximum(self.left.evaluate(rng, trials), self.right.evaluate(rng, trials)).astype(np.float64)


class Disadvantange(BinaryOperator):
    token = "disadv"
    precedence = 100

    def evaluate(self, rng, trials):
        return np.minimum(self.left.evaluate(rng, trials), self.right.evaluate(rng, trials)).astype(np.float64)


def _register_operators():
    module = globals()
    for value in module.values():
        if inspect.isclass(value) and issubclass(value, Operator) and value is not Operator:
            token = getattr(value, "token", None)
            if token is None:
                continue
            if issubclass(value, BinaryOperator):
                operator_registry.register_binary(token, value)
            elif issubclass(value, UnaryOperator):
                operator_registry.register_unary(token, value)


_register_operators()
