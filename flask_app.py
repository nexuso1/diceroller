# app.py
import os
import itertools
import numpy as np
import markdown
from flask import Flask, render_template, request, jsonify
from calc import simulate_distribution, ParseError

app = Flask(__name__)

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
    data = request.get_json()
    expression = data.get("expression", "")
    variables = data.get("variables", []) # List of dicts: [{'name': 'n', 'values': [1,2,3,4,5]}]
    
    try:
        # Check if we have active variables with valid values
        active_vars = [v for v in variables if v.get('name') and v.get('values')]
        
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
            
            results_table = []
            
            for combo in combinations:
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

    except ParseError as e:
        return jsonify({'success': False, 'error': f"Parse Error: {str(e)}"})
    except Exception as e:
        return jsonify({'success': False, 'error': f"Error: {str(e)}"})

if __name__ == "__main__":
    app.run(debug=True)