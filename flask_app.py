# app.py
import numpy as np
import markdown
import os
from flask import Flask, render_template, request, jsonify
from calc import simulate_distribution, ParseError

app = Flask(__name__)

def get_usage_guide():
    """Reads usage_guide.md and converts it into HTML."""
    try:
        # Looking for usage_guide.md in the root of the repository
        file_path = os.path.join(os.path.dirname(__file__), "usage.md")
        with open(file_path, "r", encoding="utf-8") as f:
            md_content = f.read()
        # Convert Markdown to HTML
        return markdown.markdown(md_content, extensions=['fenced_code'])
    except FileNotFoundError:
        return "<p><em>Usage guide file not found.</em></p>"

def format_computation_output(result: np.ndarray):
    # Calculate basic statistics
    mean_val = float(np.mean(result))
    median_val = float(np.median(result))
    
    # Handle ddof=1 safety check if array has 1 or fewer elements
    try:
        std_val = float(np.std(result, ddof=1))
    except (ValueError, RuntimeWarning):
        std_val = 0.0

    # Calculate Probability & Cumulative Distribution for the Chart
    # Get unique values and their absolute frequencies
    values, counts = np.unique(result, return_counts=True)
    probabilities = counts / len(result)
    cumulative_probabilities = np.cumsum(probabilities)

    return {
        'success': True,
        'mean': mean_val,
        'median': median_val,
        'std': std_val,
        # Convert NumPy arrays to Python lists so they can be JSON serialized
        'chart_data': {
            'labels': values.tolist(),
            'probabilities': probabilities.tolist(),
            'cumulative': cumulative_probabilities.tolist()
        }
    }

@app.route("/")
def home():
    guide_html = get_usage_guide()
    return render_template("index.html", guide_html=guide_html)

# API Route that the frontend Javascript will talk to
@app.route("/calculate", methods=["POST"])
def calculate():
    data = request.get_json()
    expression = data.get("expression", "")
    
    try:
        # Run your core simulation logic
        sim_data = simulate_distribution(expression)
        result = format_computation_output(sim_data)
    except ParseError as e:
        result = {
            'success': False,
            'error': f"Parse Error: {str(e)}"
        }
    except Exception as e:
        result = {
            'success': False,
            'error': f"Unexpected Error: {str(e)}"
        }
        
    return jsonify(result)

if __name__ == "__main__":
    app.run(debug=True)