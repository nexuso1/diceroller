# Deployment

The app is a stateless Flask WSGI application: no database, no secrets, nothing
written to disk. Expression history lives in each visitor's browser
(`localStorage`), so there is nothing on the server to back up.

## First deploy

```bash
git clone <repo-url> /opt/diceroller
cd /opt/diceroller
python3 -m venv venv
venv/bin/pip install -r requirements.txt
```

Check it serves before wiring up systemd:

```bash
venv/bin/gunicorn --bind 127.0.0.1:8000 --workers 2 flask_app:app
```

The WSGI entry point is `flask_app:app`. Never run `python flask_app.py` in
production — that path calls `app.run(debug=True)`, which exposes an interactive
Python console on any traceback.

Then install the service and the nginx site:

```bash
sudo cp deploy/diceroller.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now diceroller
sudo cp deploy/nginx-diceroller.conf /etc/nginx/sites-available/diceroller
sudo ln -s /etc/nginx/sites-available/diceroller /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d your.domain
```

## Updating

```bash
cd /opt/diceroller && git pull && venv/bin/pip install -r requirements.txt && sudo systemctl restart diceroller
```

## Sizing

Simulations are CPU-bound numpy, so gunicorn's sync workers should roughly match
core count — the usual `2 x cores + 1` rule is for I/O-bound apps and will just
oversubscribe the CPU here. Every request runs 200,000 trials per combination
(`calc.simulate_distribution`), which is ~30 ms for a simple expression.

## Request limits

Without limits a single unauthenticated POST to `/calculate` can pin the CPU and
exhaust memory, because the browser's caps are trivially bypassed. The limits
below are enforced server side; tune them together with `MemoryMax` in the unit
file and `--timeout` on gunicorn.

| Limit | Value | Where |
|---|---|---|
| Expression length | 200 chars | `flask_app.MAX_EXPRESSION_LENGTH` |
| Variables per request | 3 | `flask_app.MAX_VARIABLES` |
| Values per variable | 20 | `flask_app.MAX_VALUES_PER_VARIABLE` |
| Combinations per sweep | 200 | `flask_app.MAX_COMBINATIONS` |
| Wall clock per sweep | 20 s | `flask_app.SWEEP_BUDGET_SECONDS` |
| Dice per roll | 100 | `operators.MAX_DICE_COUNT` |
| Sides per die | 1000 | `operators.MAX_DICE_SIDES` |
| `repeat` count | 100 | `operators.MAX_REPEAT` |
| `reroll` range span | 1000 | `operators.MAX_RANGE_SPAN` |

Rejected requests return HTTP 400 with `{"success": false, "error": ...}`, which
the UI shows in its error banner.

The dice and repeat caps bound what a *single* expression can allocate; the
combination cap and the wall-clock budget bound a sweep. The budget is the
backstop for expressions that are individually cheap but slow in bulk — it aborts
mid-sweep with a clear message instead of letting gunicorn kill the worker.
