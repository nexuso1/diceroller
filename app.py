import streamlit as st
import numpy as np
import pandas as pd
import plotly.express as px

from calc import simulate_distribution, ParseError
MAX_COMBINATIONS=200
MATRIX_CMAP='plasma'
def parse_variable_values(value_str):
    """Parse variable values from string format.
    Supports: list (1,2,3), range (1-5), range with step (1-6:2)
    """
    value_str = value_str.strip()
    
    # Try range with step format (1-6:2)
    if ':' in value_str:
        range_part, step = value_str.split(':')
        start, end = map(int, range_part.split('-'))
        step = int(step)
        return list(range(start, end + 1, step))
    
    # Try range format (1-5)
    elif '-' in value_str and ',' not in value_str:
        parts = value_str.split('-')
        if len(parts) == 2:
            start, end = map(int, parts)
            return list(range(start, end + 1))
    
    # Try list format (1,2,3)
    try:
        return [int(x.strip()) for x in value_str.split(',')]
    except ValueError:
        return None

def substitute_variables(expression, var_dict):
    """Substitute variable values into expression"""
    result = expression
    for var_name, value in var_dict.items():
        result = result.replace(var_name, str(value))
    return result

def handle_single_variable(expression, var_name, var_values, trials, seed):
    """Handle simulation for a single variable"""
    results = []
    sim_data = {}

    if len(var_values) > MAX_COMBINATIONS:
        st.error("Too many value combinations. Reduce the ranges of variables")
        usage_guide()
        return
    
    for value in var_values:
        expr = substitute_variables(expression, {var_name: value})
        sim_values = simulate_distribution(expr, trials=int(trials), seed=int(seed))
        
        results.append({
            var_name: value,
            'Mean': float(np.mean(sim_values)),
            'Median': int(np.median(sim_values)),
            'Std Dev': float(np.std(sim_values, ddof=1))
        })
        sim_data[value] = sim_values
    
    return pd.DataFrame(results), sim_data

def handle_two_variables(expression, var1_name, var1_values, var2_name, var2_values, trials, seed):
    """Handle simulation for two variables"""
    results_mean = {}
    results_median = {}
    sim_data = {}

    if len(var1_values) * len(var2_values) > MAX_COMBINATIONS:
        st.error("Too many value combinations. Reduce the ranges of variables")
        usage_guide()
        return
    
    for v1 in var1_values:
        results_mean[v1] = {}
        results_median[v1] = {}
        sim_data[v1] = {}
        
        for v2 in var2_values:
            expr = substitute_variables(expression, {var1_name: v1, var2_name: v2})
            sim_values = simulate_distribution(expr, trials=int(trials), seed=int(seed))
            
            results_mean[v1][v2] = float(np.mean(sim_values))
            results_median[v1][v2] = int(np.median(sim_values))
            sim_data[v1][v2] = sim_values
    
    df_mean = pd.DataFrame(results_mean)
    df_mean.index.name = var1_name
    df_mean.columns.name = var2_name
    
    df_median = pd.DataFrame(results_median)
    df_median.index.name = var1_name
    df_median.columns.name = var2_name
    
    return (df_mean, df_median, sim_data)
    
@st.cache_data
def plot_dist_df(df, **kwargs):
    counts = df["result"].value_counts().sort_index(ascending=True)
    probabilities = counts / np.sum(counts)
    cumulative_probs = probabilities.cumsum()
    
    fig = px.bar(
        x=counts.index,
        y=probabilities.values,
        labels={'x': '<b>Roll Value</b>', 'y': '<b>Probability</b>', 'color': 'Cumulative Probability'},
        color=cumulative_probs.values,
        color_continuous_scale='plasma',
        color_continuous_midpoint=0.5
    )
    
    fig.update_traces(
        hovertemplate='<b>Roll Value:</b> %{x}<br><b>Probability:</b> %{y:.3f}<extra></extra>',
        selector=dict(type='bar')
    )
    
    fig.update_coloraxes(colorbar={'orientation': 'h', 'y': 1.02, 'len': 1.0})
    
    fig.add_scatter(
        x=counts.index,
        y=cumulative_probs.values,
        mode='lines+markers',
        name='Cumulative',
        line=dict(color='lightblue', width=2),
        marker=dict(size=6),
        xaxis='x',
        yaxis='y2',
        hovertemplate='<b>Cumulative Prob:</b> %{y:.3f}<extra></extra>'
    )
    
    fig.update_layout(
        yaxis2=dict(
            title='Cumulative Probability',
            overlaying='y',
            side='right',
            range=[0, 1],
            showgrid=True
        ),
        yaxis={'showgrid': False},
        hovermode='x'
    )
    
    fig.update_xaxes(tickangle=0)
    st.plotly_chart(fig, use_container_width=True, **kwargs)

@st.cache_resource
def usage_guide():
    with open('usage.md', 'r') as f:
        st.markdown(f.read())
    

def main():
    st.html("""
    <style>
        .stMainBlockContainer {
            max-width: 90rem;
        }
        @media (max-width: 768px) {
            .stMainBlockContainer {
                max-width: 100%;
                padding: 0 1rem;
            }
        }
    </style>
    """
    )

    st.title("Dice Roll Expected Value Calculator", text_alignment='center')
    st.set_page_config(page_title="Dice Calculator")
    st.divider()
    
    with st.sidebar.container():
        trials = st.slider("Trials", min_value=1000, max_value=250_000, value=100_000, step=1000)
        seed = st.number_input("Seed", min_value=0, value=42, step=1)
    st.write('**Input dice expression:**')
    text_input, button_col = st.columns([0.92, 0.08])
    with text_input:
        expression = st.text_input(label='**Input dice expression:**', label_visibility='collapsed', value="(d20 max d20 + 5 >= 15) * (2d6 + 5)")
    with button_col:
        run = st.button("Simulate", type='primary', shortcut='S', use_container_width=True)

    # Variables section
    st.write('**Variables (Optional)**')
    if 'variables' not in st.session_state:
        st.session_state.variables = {}
    
    variables = st.session_state.variables
    
    col_add, col_count = st.columns([0.8, 0.2])
    with col_add:
        if st.button("Add Variable", key="add_var_btn"):
            if len(variables) < 2:
                var_id = f"var_{len(variables)}"
                variables[var_id] = {"name": "n", "values": "1-5"}
                st.session_state.variables = variables
                st.rerun()
    
    with col_count:
        st.text(f"Current number of variables: {len(variables)}/2", text_alignment='right')
    
    # Display existing variables
    for var_id in list(variables.keys()):
        var_data = variables[var_id]
        with st.expander(f"{var_data.get('name', 'Unnamed variable')}", expanded=True):
            col1, col2 = st.columns([0.5, 0.5])
            with col1:
                name = st.text_input("Variable name", value=var_data.get('name', 'n'), key=f"{var_id}_name")
                variables[var_id]['name'] = name
            with col2:
                values = st.text_input(
                    "Values (e.g., 1,2,3 or 1-5 or 1-6:2)", 
                    value=var_data.get('values', '1-5'), 
                    key=f"{var_id}_values",
                    help="List: 1,2,3 | Range: 1-5 | Range with step: 1-6:2"
                )
                variables[var_id]['values'] = values
            if st.button("Delete", key=f"{var_id}_delete", help="Remove this variable"):
                del variables[var_id]
                if 'sim_results' in st.session_state:
                    del st.session_state['sim_results']
                st.session_state.variables = variables
                st.rerun()
            
            # Show parsed values if available
            if values:
                parsed = parse_variable_values(values)
                if parsed:
                    st.caption(f"Parsed values: {parsed}")
                else:
                    st.error("Invalid format")
        
        st.session_state.variables = variables

    if not expression:
        st.warning("Enter a dice expression to simulate.")
        usage_guide()
        return
    
    # Check if variables are defined and valid
    valid_variables = {}
    for var_id, var_data in st.session_state.variables.items():
        if var_data.get('name') and var_data.get('values'):
            parsed_values = parse_variable_values(var_data['values'])
            if parsed_values:
                valid_variables[var_data['name']] = parsed_values
    
    if run:
        try:
            with st.spinner("Simulating distribution..."):
                # Case 1: No variables - single simulation
                if not valid_variables:
                    values = simulate_distribution(expression, trials=int(trials), seed=int(seed))
                    st.session_state.sim_results = {
                        'type': 'single',
                        'values': values
                    }
                
                # Case 2: One variable
                elif len(valid_variables) == 1:
                    var_name = list(valid_variables.keys())[0]
                    var_values = valid_variables[var_name]
                    results = handle_single_variable(expression, var_name, var_values, trials, seed)

                    if not results:
                        return
                    
                    df, sim_data = results
                    st.session_state.sim_results = {
                        'type': 'single_var',
                        'var_name': var_name,
                        'var_values': var_values,
                        'df': df,
                        'sim_data': sim_data
                    }
                
                # Case 3: Two variables
                elif len(valid_variables) == 2:
                    var_names = list(valid_variables.keys())
                    var1_name, var2_name = var_names[0], var_names[1]
                    var1_values, var2_values = valid_variables[var1_name], valid_variables[var2_name]
                    results = handle_two_variables(expression, var1_name, var1_values, var2_name, var2_values, trials, seed)
                    if not results:
                        return
                    
                    df_mean, df_median, sim_data = results
                    st.session_state.sim_results = {
                        'type': 'two_var',
                        'var1_name': var1_name,
                        'var2_name': var2_name,
                        'var1_values': var1_values,
                        'var2_values': var2_values,
                        'df_mean': df_mean,
                        'df_median': df_median,
                        'sim_data': sim_data
                    }
        except ParseError as e:
            st.error(e)
            usage_guide()
            return
        
    # Display results if they exist in session state
    if 'sim_results' in st.session_state:
        results = st.session_state.sim_results
        
        if results['type'] == 'single':
            values = results['values']
            summary_col, graph_col = st.columns([0.35, 0.65], gap='medium')
            
            mean = float(np.mean(values))
            median = int(np.median(values))
            stddev = float(np.std(values, ddof=1))
            
            with summary_col:
                st.subheader("Result Summary", text_alignment='center')
                summary_data = pd.DataFrame({
                    "Metric": ["Mean", "Median", "Standard deviation (bias corrected)"],
                    "Value": [f"{mean:.3f}", f"{median}", f"{stddev:.3f}"]
                })
                # styled_summary = summary_data.style.background_gradient(cmap=MATRIX_CMAP, subset=['Value'])
                st.dataframe(summary_data,use_container_width=True, hide_index=True)
            with graph_col:
                df = pd.DataFrame({"result": values})
                plot_dist_df(df)
        
        elif results['type'] == 'single_var':
            summary_col, graph_col = st.columns([0.35, 0.65], gap='medium')
            
            with summary_col:
                st.subheader("Result Summary", text_alignment='center')
                styled_df = results['df'].style.background_gradient(cmap=MATRIX_CMAP, subset=['Mean', 'Median', 'Std Dev'])
                st.dataframe(styled_df, use_container_width=True, hide_index=True)
            
            with graph_col:
                st.subheader("Result Distribution", text_alignment='center')
                selected_value = st.slider(f"Select {results['var_name']} value:", min_value=min(results['var_values']), max_value=max(results['var_values']), value=results['var_values'][0])
                
                if selected_value in results['sim_data']:
                    values = results['sim_data'][selected_value]
                    df_dist = pd.DataFrame({"result": values})
                    plot_dist_df(df_dist)
        
        elif results['type'] == 'two_var':
            summary_col, graph_col = st.columns([0.5, 0.5], gap='medium')
            
            with summary_col:
                st.subheader("Result Summary", text_alignment='center')
                st.text("Mean", text_alignment='center')
                styled_mean = results['df_mean'].style.background_gradient(cmap=MATRIX_CMAP).format("{:.2f}")
                st.dataframe(styled_mean, use_container_width=True)
                st.text("Median", text_alignment='center')
                styled_median = results['df_median'].style.background_gradient(cmap=MATRIX_CMAP)
                st.dataframe(styled_median, use_container_width=True)
            
            with graph_col:
                st.subheader("Result Distribution", text_alignment='center')
                col1, col2 = st.columns(2)
                with col1:
                    selected_v1 = st.slider(f"Select {results['var1_name']}:", min_value=min(results['var1_values']), max_value=max(results['var1_values']), value=results['var1_values'][0])
                with col2:
                    selected_v2 = st.slider(f"Select {results['var2_name']}:", min_value=min(results['var2_values']), max_value=max(results['var2_values']), value=results['var2_values'][0])
                
                if selected_v1 in results['sim_data'] and selected_v2 in results['sim_data'][selected_v1]:
                    values = results['sim_data'][selected_v1][selected_v2]
                    df = pd.DataFrame({"result": values})
                    plot_dist_df(df, height='stretch')
    
    usage_guide()

if __name__ == "__main__":
    main()
