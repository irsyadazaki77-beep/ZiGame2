# ZiGame 2.0 Operational Runbook & Incident Response Playbook

## 1. Overview & Severity Levels
This runbook defines standard operating procedures for the ZiGame 2.0 web application and backend services.

| Severity | Definition | Response Target |
| :--- | :--- | :--- |
| **SEV-1 (Critical)** | Active economy exploit, database outage, score spoofing epidemic | < 15 minutes |
| **SEV-2 (High)** | Degradation in ranked matchmaking, seasonal reset mismatch | < 1 hour |
| **SEV-3 (Medium)** | Minor UI animation glitch, single user data discrepancy | < 24 hours |

---

## 2. Emergency Kill Switches (Fast Containment)

If an active vulnerability is detected, engage the appropriate emergency kill switch immediately from the **Admin Console** or via curl:

```bash
# Emergency Disable Economy Transactions
curl -X POST https://ais-dev-...run.app/api/admin/kill-switches \
  -H "Authorization: Bearer <ADMIN_ID_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"feature": "economy", "active": true}'

# Emergency Disable Ranked Matches
curl -X POST https://ais-dev-...run.app/api/admin/kill-switches \
  -H "Authorization: Bearer <ADMIN_ID_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"feature": "ranked", "active": true}'

# Emergency Disable Seasons
curl -X POST https://ais-dev-...run.app/api/admin/kill-switches \
  -H "Authorization: Bearer <ADMIN_ID_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"feature": "seasons", "active": true}'
```

---

## 3. Incident Playbooks

### Playbook A: Economy Exploit (Duplication / Negative Coins / Unauthorized Claims)
1. **Containment**: Toggle the `economy` kill switch to `active: true`.
2. **Audit & Trace**: Run user reconciliation on suspect accounts via `POST /api/admin/reconcile-economy` with `{ "userId": "<SUSPECT_UID>" }`.
3. **Inspect Ledger**: Check Firestore collection `economyTransactions` for negative debits, unverified idempotency keys, or missing nonces.
4. **Remediation**: Adjust user balance in Firestore `userEconomy/<UID>` to match valid ledger sum.
5. **Recovery**: Deploy hotfix if necessary, then toggle `economy` kill switch back to `false`.

### Playbook B: Ranked / Score Spoofing Exploit
1. **Containment**: Toggle the `ranked` kill switch to `active: true`.
2. **Purge Anomaly Scores**: Invoke `POST /api/admin/purge-suspect-scores` to remove velocity-violating records from global leaderboards.
3. **Verify Ceilings**: Check `src/config/balanceConfig.ts` to ensure max score ceiling and min duration rules are sufficient.
4. **Recovery**: Toggle `ranked` kill switch back to `false`.

### Playbook C: Firestore Database Outage / High Latency
1. **Symptoms**: `/api/ready` returns HTTP 503 with `"status": "not_ready"`.
2. **Assessment**: Check Google Cloud Console / Firebase Status dashboard for Firestore region `asia-southeast1`.
3. **Action**: The server automatically activates in-memory transaction queuing and rate-limiting fallbacks.
4. **Recovery**: When Firestore connectivity resumes, the server auto-reconnects. Admin can run `POST /api/admin/force-sync` to sync runtime states.

### Playbook D: Broken Release Rollback
1. If a new deployment introduces fatal errors, revert the container image or branch to previous stable release tag `v2.0.0-RC1`.
2. Verify system readiness with `curl https://<APP_URL>/api/ready`.

---

## 4. Health & Monitoring Endpoints
- **Liveness Probe**: `GET /api/liveness` (Returns HTTP 200 if Node.js process is alive)
- **Readiness Probe**: `GET /api/ready` (Returns HTTP 200 when database connection is operational)
- **System Health**: `GET /api/health` (Returns persistence mode, memory usage, and version info)
- **Live Ops Stats**: `GET /api/admin/stats` (Requires admin authorization)
