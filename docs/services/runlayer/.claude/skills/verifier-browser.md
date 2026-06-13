# Browser Verifier — runlayer

Use this skill when verifying frontend changes to the dashboard at `https://runlayer.alfares.cz`.

## Setup

Python Playwright is installed system-wide (`pip install --break-system-packages playwright` + `python3 -m playwright install chromium`).

Test credentials:
- Email: `test@example.com`
- Password: `70fdxIwqY7qUg7vXgaWUm/GBPPH5pAYy`

## Login boilerplate

```python
from playwright.sync_api import sync_playwright

EMAIL = 'test@example.com'
PASSWORD = '<REDACTED_SYNTHETIC_PASSWORD>'
BASE = 'https://runlayer.alfares.cz'

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    ctx = browser.new_context(ignore_https_errors=True)
    page = ctx.new_page()

    # Login
    page.goto(BASE + '/')
    page.wait_for_timeout(1500)
    page.query_selector('a:has-text("Sign in"), button:has-text("Sign in")').click()
    page.wait_for_timeout(1000)
    page.query_selector('input[type="email"]').fill(EMAIL)
    page.query_selector('input[type="password"]').fill(PASSWORD)
    page.query_selector('button[type="submit"]').click()
    page.wait_for_timeout(5000)  # wait for auth + initial portfolio load
```

## Waiting for dynamic content

The dashboard renders content asynchronously after fetch calls. Always wait for the container to have real content before asserting:

```python
page.goto(BASE + '/tasks')
try:
    page.wait_for_function(
        "document.getElementById('tasks-container') && !document.getElementById('tasks-container').textContent.includes('Loading')",
        timeout=10000
    )
except:
    pass
page.wait_for_timeout(1000)
```

## Taking screenshots

```python
page.screenshot(path='/tmp/verify_<feature>.png', full_page=True)
```

Read screenshots with the Read tool to visually inspect the result.

## Key element selectors

| Element | Selector |
|---------|----------|
| Tasks filter bar | `.task-filter-bar` |
| Project filter dropdown | `.task-filter-select` (first one) |
| Status filter dropdown | `.task-filter-select` (second one) |
| Dependency Graph button | `button:has-text("Dependency Graph")` |
| Table button | `button:has-text("Table")` |
| Tasks container | `#tasks-container` |
| Tasks view section | `#tasks-view` |
| Goal detail view | `#goal-detail-view` |
| Nav links | `a.nav-link[href="/tasks"]` etc. |

## Checking computed visibility

```python
display = page.evaluate("window.getComputedStyle(document.getElementById('tasks-view')).display")
# 'block' = visible, 'none' = hidden
```

## Checking localStorage token

```python
token = page.evaluate("localStorage.getItem('accessToken')")
```

## Docker cache note

`deploy.sh` builds a Docker image tagged with the current git HEAD hash. If `public/app.js` changes are not committed, Docker may cache the old layer and deploy stale JS. To verify the running pod has the right code:

```bash
POD=$(kubectl get pod -n statex-apps -l app=runlayer -o jsonpath='{.items[0].metadata.name}')
kubectl exec -n statex-apps $POD -- grep -c "your_change_string" /app/public/app.js
```

If the pod has old code, patch it directly (temporary, until commit + redeploy):

```bash
kubectl cp public/app.js statex-apps/$POD:/app/public/app.js
```
