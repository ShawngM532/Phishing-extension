# Collection pipeline

The evaluation dataset is built by a scheduled, idempotent collector. This keeps
`first_seen` honest so the model can be trained and evaluated on a real temporal
split (PRD §6.10).

## Data layout (gitignored)

```
pipeline/data/
  raw/openphish_<YYYY-MM-DD>.parquet    phishing URLs first seen that day
  crawled/crawl_<timestamp>.parquet     crawl results (one file per run)
  html/<sha256>.html                    page HTML, content-addressed
```

`first_seen` is the earliest daily raw file a URL appears in. The store is
append-only: re-running the collector never re-dates a URL and never re-fetches a
crawled URL.

Only a small frozen fixture subset is committed (see `docs/DATASET.md`); the full
store stays local.

## Running it

```bash
cd pipeline
uv run python run_collection.py              # discover + crawl
uv run python run_collection.py --collect    # discovery only
uv run python run_collection.py --crawl      # crawl pending only
uv run python run_collection.py --crawl --limit 20
```

Configured in `config.yaml`. Crawls are polite: bounded concurrency (16),
media/fonts/stylesheets blocked, 10 s timeout, one retry.

## Scheduling (every 6 hours)

Phishing pages die fast; the PRD wants crawls within ~6 h of feed publication.

### Windows (Task Scheduler)

```powershell
$pipeline = "E:\Programming_folder\Phishing-extension\pipeline"
$action = New-ScheduledTaskAction -Execute "cmd.exe" `
  -Argument "/c cd /d `"$pipeline`" && uv run python run_collection.py >> data\collection.log 2>&1"
$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date).Date `
  -RepetitionInterval (New-TimeSpan -Hours 6)
Register-ScheduledTask -TaskName "SentinelCollect" -Action $action -Trigger $trigger
```

### Linux / macOS (cron)

```
0 */6 * * * cd /path/to/pipeline && uv run python run_collection.py >> data/collection.log 2>&1
```

## Testing without touching the network

The unit tests cover URL normalisation, feed parsing, idempotency, storage and the
crawl filter entirely offline:

```bash
cd pipeline && uv run pytest
```
