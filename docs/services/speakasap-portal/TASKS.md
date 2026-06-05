# Tasks: speakasap-portal

## Backlog

- [ ] ISSUE-106: run targeted runtime checks for notification + merge flows (priority: 1)
- [ ] ISSUE-107: verify last-hour logs are clean after deployment (priority: 1)
- [ ] ISSUE-108: if S3 delete still fails, validate creds/region/endpoint from `.env` source (priority: 1)
- [ ] ISSUE-109: add grouped log-analyze command note for recurring checks (priority: 3)
- [ ] ISSUE-106: run targeted runtime checks for notification + merge flows (priority: 1)
- [ ] ISSUE-107: verify last-hour logs are clean after deployment (priority: 1)
- [ ] ISSUE-108: if S3 delete still fails, validate creds/region/endpoint from `.env` source (priority: 1)
- [ ] ISSUE-109: add grouped log-analyze command note for recurring checks (priority: 3)

## Completed
<!-- AI appends here. Never modifies previous entries. -->
- [x] 2026-04-05 Documentation standard applied
- [x] 2026-04-28 Log analysis completed, root causes grouped, remediation plan created
- [x] 2026-04-28 ISSUE-101: notification resolver supports UUID lesson IDs without int cast failures
- [x] 2026-04-28 ISSUE-102: merge_records S3 cleanup switched to direct SigV4 client delete path
- [x] 2026-04-28 ISSUE-103: merge_records no longer uses direct S3 size checks in step-14
- [x] 2026-04-28 ISSUE-104: duplicate LessonSalaryExpense events downgraded to idempotent info log
- [x] 2026-04-28 ISSUE-105: merge_records missing/already-processed records treated as terminal info state
