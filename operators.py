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
        self.value = np.float32(value)

    def evaluate(self, rng, trials):
        return self.value


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
    precedence = 110

    def evaluate(self, rng, trials, return_rolls=False, count=None):
        if count is None:
            count = self.left.evaluate(rng, trials).astype(np.int32)
        self.sides = self.right.evaluate(rng, trials).astype(np.int32)

        if count < 1 or self.sides < 1:
            raise ValueError("Dice count and sides must be positive")
        if count == 1:
            return rng.integers(1, self.sides + 1, size=trials, dtype=np.int32).astype(np.float32)
        rolls = rng.integers(1, self.sides + 1, size=(trials, count), dtype=np.int32).astype(np.float32)

        if return_rolls:
            return rolls
        
        return rolls.sum(-1)

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
        return (self.left.evaluate(rng, trials) > self.right.evaluate(rng, trials)).astype(np.float32)


class Less(BinaryOperator):
    token = "<"
    precedence = 10

    def evaluate(self, rng, trials):
        return (self.left.evaluate(rng, trials) < self.right.evaluate(rng, trials)).astype(np.float32)


class GreaterEqual(BinaryOperator):
    token = ">="
    precedence = 10

    def evaluate(self, rng, trials):
        return (self.left.evaluate(rng, trials) >= self.right.evaluate(rng, trials)).astype(np.float32)


class LessEqual(BinaryOperator):
    token = "<="
    precedence = 10

    def evaluate(self, rng, trials):
        return (self.left.evaluate(rng, trials) <= self.right.evaluate(rng, trials)).astype(np.float32)


class Equal(BinaryOperator):
    token = "=="
    precedence = 10

    def evaluate(self, rng, trials):
        return (self.left.evaluate(rng, trials) == self.right.evaluate(rng, trials)).astype(np.float32)


class NotEqual(BinaryOperator):
    token = "!="
    precedence = 10

    def evaluate(self, rng, trials):
        return (self.left.evaluate(rng, trials) != self.right.evaluate(rng, trials)).astype(np.float32)


class Max(BinaryOperator):
    token = "max"
    precedence = 100

    def evaluate(self, rng, trials):
        return np.maximum(self.left.evaluate(rng, trials), self.right.evaluate(rng, trials)).astype(np.float32)


class Min(BinaryOperator):
    token = "min"
    precedence = 100

    def evaluate(self, rng, trials):
        return np.minimum(self.left.evaluate(rng, trials), self.right.evaluate(rng, trials)).astype(np.float32)
    
class Repeat(BinaryOperator):
    token = "repeat"
    precedence = 5

    def evaluate(self, rng, trials):
        n = int(self.right.evaluate(rng, trials))
        results = [self.left.evaluate(rng, trials) for _ in range(n)]
        return np.asarray(results, dtype=np.float32).sum(0)
    

class Range(BinaryOperator):
    token = ":"
    precedence = 106

    def evaluate(self, rng, trials):
        start = self.left.evaluate(rng, trials)
        stop = self.right.evaluate(rng, trials)
        return np.asarray([i for i in range(int(start), int(stop) + 1)])

class Reroll(BinaryOperator):
    token = "reroll"
    precedence = 105

    def evaluate(self, rng, trials):
        try:
            rolls = self.left.evaluate(rng, trials, return_rolls=True)
        except TypeError:
            raise ValueError('Reroll operator expects a dice roll as the left operand.')
        
        to_reroll = self.right.evaluate(rng, trials)
        mask = np.zeros_like(rolls, dtype=np.bool)

        if len(to_reroll.shape) > 0: 
            for val in to_reroll:
                mask = mask | (rolls == val)
        else:
            mask = rolls == to_reroll

        rolls[mask] = self.left.evaluate(rng, trials=mask.sum(), count=1, return_rolls=True).reshape(-1)
        return rolls.sum(-1)

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
