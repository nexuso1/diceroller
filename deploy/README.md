# Deployment

The app is a stateless Flask WSGI application: no database, no secrets, nothing
written to disk. Expression history lives in each visitor's browser
(`localStorage`), so there is nothing on the server to back up.

Target layout: the repo at `/srv/diceroller`, inside a container that runs
supervisor as its init, with nginx listening on `8000` and gunicorn on
`127.0.0.1:8080` behind it.

```
browser -> :8000 nginx -> 127.0.0.1:8080 gunicorn -> flask_app:app
                     \-> /static/ served from /srv/diceroller/static/
```

## First deploy

Build the venv (skip it and install into the system python if the image is
dedicated to this app — a container is already an isolated environment):

```bash
cd /srv/diceroller && python3 -m venv venv && venv/bin/pip install -r requirements.txt
```

Check it serves before handing it to supervisor:

```bash
/srv/diceroller/venv/bin/gunicorn --bind 127.0.0.1:8080 --workers 2 flask_app:app
```

The WSGI entry point is `flask_app:app`. Never run `python flask_app.py` in
production — that path calls `app.run(debug=True)`, which exposes an interactive
Python console on any traceback.

Install the process config and the nginx site:

```bash
cp deploy/supervisor-diceroller.conf /etc/supervisor/conf.d/diceroller.conf
```

```bash
supervisorctl reread && supervisorctl update && supervisorctl status diceroller
```

```bash
cp deploy/nginx-diceroller.conf /etc/nginx/conf.d/default.conf
```

```bash
nginx -t && nginx -s reload
```

If the image bakes the repo in at build time, do the venv and the two config
copies in the Dockerfile instead, and keep only `supervisorctl` for restarts.

## Updating

```bash
cd /srv/diceroller && git pull && venv/bin/pip install -r requirements.txt && supervisorctl restart diceroller
```

Rebuild and redeploy the image instead if the repo is baked in at build time.

## Container notes

- **Memory.** There is no systemd `MemoryMax` here, so the limit is the
  container's: run with `--memory=1g` (or `mem_limit` in compose). Without one, a
  pathological request is capped only by the app's own limits and the host OOM
  killer picks the victim.
- **Workers.** `nproc` inside a container reports the *host's* cores, not the
  container's CPU limit. Size `--workers` to the limit you actually gave the
  container — these are CPU-bound numpy simulations, so oversubscribing only adds
  contention. Two workers is a reasonable default; one is right for a 1-CPU
  container.
- **Logs.** The supervisor config sends gunicorn's access log and tracebacks to
  the container's stdout/stderr, so `docker logs` is the single place to look.
- **TLS.** Nothing here terminates HTTPS; the container speaks plain HTTP on
  8000. Certificates belong to whatever fronts the container (host nginx, a load
  balancer, or the platform's ingress). If that front end terminates TLS, have it
  send `X-Forwarded-Proto` — the app does not currently read it, but anything
  added later that builds absolute URLs will need it.
- **Restarts.** `autorestart=true` covers crashes; the container's own restart
  policy (`--restart unless-stopped`) covers the container dying.

## Sizing

Simulations are CPU-bound numpy, so gunicorn's sync workers should roughly match
the available cores — the usual `2 x cores + 1` rule is for I/O-bound apps. Every
request runs 200,000 trials per combination (`calc.simulate_distribution`), which
is ~30 ms for a simple expression.

## Request limits

Without limits a single unauthenticated POST to `/calculate` can pin the CPU and
exhaust memory, because the browser's caps are trivially bypassed. The limits
below are enforced server side; tune them together with the container's memory
limit and gunicorn's `--timeout`.

| Limit | Value | Where |
|---|---|---|
| Expression length | 200 chars | `flask_app.MAX_EXPRESSION_LENGTH` |
| Variables per request | 3 | `flask_app.MAX_VARIABLES` |
| Values per variable | 20 | `flask_app.MAX_VALUES_PER_VARIABLE` |
| Combinations per sweep | 200 | `flask_app.MAX_COMBINATIONS` |
| Wall clock per sweep | 20 s | `flask_app.SWEEP_BUDGET_SECONDS` |
| Dice per roll | 100 | `operators.MAX_DICE_COUNT` |
| Sides per die | 1000 | `operators.MAX_DICE_SIDES` |
| `repeat` count | 50 | `operators.MAX_REPEAT` |
| `reroll` range span | 100 | `operators.MAX_RANGE_SPAN` |

Rejected requests return HTTP 400 with `{"success": false, "error": ...}`, which
the UI shows in its error banner.

The dice and repeat caps bound what a *single* expression can allocate; the
combination cap and the wall-clock budget bound a sweep. The budget is the
backstop for expressions that are individually cheap but slow in bulk — it aborts
mid-sweep with a clear message instead of letting gunicorn kill the worker.

Keep the three timeouts ordered: `SWEEP_BUDGET_SECONDS` (20 s) <
`proxy_read_timeout` (60 s) <= gunicorn `--timeout` (60 s). If you raise the
app's budget, raise the other two with it, or nginx will return its own 504
before the app can explain what went wrong.
