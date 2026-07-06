import streamlit as st
import numpy as np
import pandas as pd
import plotly.express as px

from calc import simulate_distribution

def usage_guide():
    st.markdown("""
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
    """)

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

    if not expression:
        st.warning("Enter a dice expression to simulate.")
        usage_guide()
        return
    if run:
        with st.spinner("Simulating distribution..."):
            values = simulate_distribution(expression, trials=int(trials), seed=int(seed))


        summary_col, graph_col   = st.columns([0.35, 0.65], gap='medium')

        mean = float(np.mean(values))
        median = int(np.median(values))
        stddev = float(np.std(values, ddof=1))

        with summary_col:
            st.subheader("Result Summary", text_alignment='center')
            st.table(
                {
                    "Mean" : f"{mean:.3f}",
                    "Median" : f"{median}",
                    "Standard deviation (bias corrected)" : f"{stddev:.3f}"
                }
            )
        with graph_col:
            df = pd.DataFrame({"result": values})
            counts = df["result"].value_counts().sort_index(ascending=True)
            probabilities = counts / np.sum(counts)
            cumulative_probs = probabilities.cumsum()
            
            st.subheader("Result Distribution", text_alignment='center')
            fig = px.bar(
                x=counts.index,
                y=probabilities.values,
                labels={'x': '<b>Roll Value</b>', 'y': '<b>Probability</b>', 'color' : 'Cumulative Probability'},
                color=cumulative_probs.values,
                color_continuous_scale='plasma',
            )

            # Hide color information from hover on bar chart
            fig.update_traces(
                hovertemplate='<b>Roll Value:</b> %{x}<br><b>Probability:</b> %{y:.3f}<extra></extra>',
                selector=dict(type='bar')
            )


            fig.update_coloraxes(colorbar={'orientation' : 'h', 'y' : 1.02, 'len' : 1.0} )
            
            # Add cumulative distribution line
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
            
            # Update layout to show secondary y-axis
            fig.update_layout(
                yaxis2=dict(
                    title='Cumulative Probability',
                    overlaying='y',
                    side='right',
                    range=[0, 1],
                    showgrid=True
                ),
                yaxis={'showgrid' : False},
                hovermode='x',
                # legend=dict(
                #     x=1.2,
                #     y=0.45,
                #     xanchor='right',
                #     yanchor='bottom'
                # )
            )

            
            fig.update_xaxes(tickangle=0)
            st.plotly_chart(fig, use_container_width=True)
    
    usage_guide()

if __name__ == "__main__":
    main()
