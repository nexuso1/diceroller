# app.py
import os
import time
import itertools
import numpy as np
import markdown
from flask import Flask, render_template, request, jsonify
from calc import simulate_distribution, ParseError

app = Flask(__name__)

# Request limits. The browser caps variables at three and 200k trials run per
# combination, but nothing stops a hand-written POST from asking for the
# cartesian product of three 100-value variables, so the server enforces its own.
MAX_EXPRESSION_LENGTH = 200
MAX_VARIABLES = 3
MAX_VALUES_PER_VARIABLE = 20
MAX_COMBINATIONS = 200
# Backstop for expressions that are individually legal but slow in bulk; keep it
# comfortably under the gunicorn --timeout so the worker answers instead of dying.
SWEEP_BUDGET_SECONDS = 20


class RequestRejected(Exception):
    """The request asks for more work than this server is willing to do."""


def validate_expression(expression):
    if not isinstance(expression, str) or not expression.strip():
        raise RequestRejected("No expression given.")
    if len(expression) > MAX_EXPRESSION_LENGTH:
        raise RequestRejected(f"Expression is too long (limit {MAX_EXPRESSION_LENGTH} characters).")
    return expression


def validate_variables(variables):
    """Keep only usable variables, rejecting anything oversized or malformed."""
    if not isinstance(variables, list):
        raise RequestRejected("Variables must be a list.")

    active = []
    for variable in variables:
        if not isinstance(variable, dict):
            raise RequestRejected("Each variable must be an object.")

        name, values = variable.get('name'), variable.get('values')
        if not name or not values:
            continue
        if not isinstance(values, list):
            raise RequestRejected(f"Values for '{name}' must be a list of numbers.")
        if any(isinstance(v, bool) or not isinstance(v, (int, float)) for v in values):
            raise RequestRejected(f"Values for '{name}' must be numbers.")
        if len(values) > MAX_VALUES_PER_VARIABLE:
            raise RequestRejected(
                f"Variable '{name}' has {len(values)} values (limit {MAX_VALUES_PER_VARIABLE})."
            )
        active.append({'name': str(name), 'values': values})

    if len(active) > MAX_VARIABLES:
        raise RequestRejected(f"At most {MAX_VARIABLES} variables are supported.")
    return active

def get_usage_guide():
    try:
        file_path = os.path.join(os.path.dirname(__file__), "usage.md")
        with open(file_path, "r", encoding="utf-8") as f:
            md_content = f.read()
        return markdown.markdown(md_content, extensions=['fenced_code'])
    except FileNotFoundError:
        return "<p><em>Usage guide file not found.</em></p>"

def compute_single_stats(result: np.ndarray):
    """Utility to compute summary stats for a single distribution."""
    try:
        std_val = float(np.std(result, ddof=1))
    except (ValueError, RuntimeWarning):
        std_val = 0.0
    return {
        'mean': float(np.mean(result)),
        'median': float(np.median(result)),
        'std': std_val
    }

@app.route("/")
def home():
    return render_template("index.html", guide_html=get_usage_guide())

@app.route("/calculate", methods=["POST"])
def calculate():
    data = request.get_json(silent=True) or {}

    try:
        expression = validate_expression(data.get("expression", ""))
        # List of dicts: [{'name': 'n', 'values': [1,2,3,4,5]}]
        active_vars = validate_variables(data.get("variables", []))

        if not active_vars:
            # --- 1. SINGLE EXPRESSION MODE (Original Logic) ---
            sim_data = simulate_distribution(expression)
            stats = compute_single_stats(sim_data)
            
            # Generate chart metrics
            values, counts = np.unique(sim_data, return_counts=True)
            probabilities = counts / len(sim_data)
            cumulative_probabilities = np.cumsum(probabilities)
            
            return jsonify({
                'success': True,
                'mode': 'single',
                'mean': stats['mean'],
                'median': stats['median'],
                'std': stats['std'],
                'chart_data': {
                    'labels': values.tolist(),
                    'probabilities': probabilities.tolist(),
                    'cumulative': cumulative_probabilities.tolist()
                }
            })
            
        else:
            # --- 2. MULTI-VARIABLE PARAMETRIC MODE ---
            # Sort variables by name for deterministic table column rendering
            active_vars.sort(key=lambda x: x['name'])
            var_names = [v['name'] for v in active_vars]
            var_value_lists = [v['values'] for v in active_vars]
            
            # Calculate Cartesian product of all variable values
            combinations = list(itertools.product(*var_value_lists))
            if len(combinations) > MAX_COMBINATIONS:
                raise RequestRejected(
                    f"That sweep is {len(combinations)} combinations (limit {MAX_COMBINATIONS}). "
                    "Use fewer values or fewer variables."
                )

            results_table = []
            deadline = time.monotonic() + SWEEP_BUDGET_SECONDS

            for combo in combinations:
                if time.monotonic() > deadline:
                    raise RequestRejected(
                        f"Sweep exceeded {SWEEP_BUDGET_SECONDS}s after {len(results_table)} of "
                        f"{len(combinations)} combinations. Simplify the expression or use fewer values."
                    )

                # Map variable names to their corresponding values for this iteration
                combo_dict = dict(zip(var_names, combo))
                
                # Interpolate values into the expression safely
                temp_expression = expression
                for var_name, val in combo_dict.items():
                    # Word boundaries or simple replace depending on your parser's requirements.
                    # Simple replace is used here:
                    temp_expression = temp_expression.replace(var_name, str(val))
                
                # Simulate the current variation
                sim_data = simulate_distribution(temp_expression)
                stats = compute_single_stats(sim_data)
                
                # Build row entry
                row = {
                    'combination': combo_dict, # e.g. {'n': 3, 'k': 15}
                    'mean': stats['mean'],
                    'median': stats['median'],
                    'std': stats['std']
                }
                results_table.append(row)
                
            return jsonify({
                'success': True,
                'mode': 'multi',
                'variables_ordered': var_names,
                'results': results_table
            })

    except RequestRejected as e:
        return jsonify({'success': False, 'error': str(e)}), 400
    except ParseError as e:
        return jsonify({'success': False, 'error': f"Parse Error: {str(e)}"})
    except Exception as e:
        return jsonify({'success': False, 'error': f"Error: {str(e)}"})

if __name__ == "__main__":
    app.run(debug=True)