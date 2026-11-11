## Load test: 200 users (2026-11-11T06:30:09.161Z)

load test: 200 students, pool of 28 questions

### Exam: 200 students, same assessment, autosave (103 s)

| Endpoint | Requests | p50 ms | p95 ms | p99 ms | max ms |
|---|---|---|---|---|---|
| GET state | 1400 | 1224 | 2223 | 2688 | 4233 |
| POST start | 200 | 4760 | 4936 | 4951 | 4952 |
| PUT answer (autosave) | 4000 | 379 | 1247 | 1789 | 1938 |
| POST advance | 2000 | 3455 | 5539 | 7570 | 7779 |

Requests: 7600, failed: 0 (0.00%)
Finished exams: 200/200. Timer drift beyond the 1 s display resolution: p95 0 ms, p99 259 ms, max 744 ms (600 checks)

Live: 200 participants connected, 1000 answers accepted (expected 1000); socket push latency p50 6 ms, p95 110 ms, p99 128 ms (3200 pushes)

### Live session: 200 participants

| Endpoint | Requests | p50 ms | p95 ms | p99 ms | max ms |
|---|---|---|---|---|---|
| POST live session | 1 | 20 | 20 | 20 | 20 |
| POST join | 200 | 46 | 131 | 144 | 155 |
| POST control | 11 | 29 | 155 | 155 | 155 |
| GET live/me | 1000 | 1222 | 1306 | 1326 | 1332 |
| POST live answer | 1000 | 76 | 212 | 622 | 677 |

Requests: 2212, failed: 0 (0.00%)

Peak memory of the server (Node + children): 130 MB

## Load test: 400 users (2026-11-11T06:33:23.969Z)

load test: 400 students, pool of 28 questions

### Exam: 400 students, same assessment, autosave (203 s)

| Endpoint | Requests | p50 ms | p95 ms | p99 ms | max ms |
|---|---|---|---|---|---|
| GET state | 2800 | 3925 | 5637 | 6295 | 6700 |
| POST start | 400 | 7268 | 7712 | 7741 | 7745 |
| PUT answer (autosave) | 8000 | 1287 | 2353 | 2570 | 2723 |
| POST advance | 4000 | 9945 | 12438 | 13611 | 13648 |

Requests: 15200, failed: 0 (0.00%)
Finished exams: 400/400. Timer drift beyond the 1 s display resolution: p95 8 ms, p99 401 ms, max 588 ms (1200 checks)

Peak memory of the server (Node + children): 140 MB

