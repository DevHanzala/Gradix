server up: {"instructor":1,"students":[2,3,4],"assessment":1}

| Step | Status | Detail |
|---|---|---|
| pool generation (3 languages) | 202 | en 28, ur 28, ar 27 |
| PDF report (Urdu, real Chromium) | 200 | 279 KB |
| DOCX paper x3 (Urdu) | 200 | 10 KB |
| PDF paper x3 (Arabic) | 200 | 164 KB |
| /api/health | 200 | ok, Node RSS 125 MB |

| Phase | Peak memory, Node + Chromium (MB) |
|---|---|
| boot | 93 |
| idle | 93 |
| pool generation | 105 |
| PDF report | 327 |
| DOCX paper | 127 |
| PDF paper | 125 |
| after | 125 |
