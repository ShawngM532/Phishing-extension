# Evaluation — fixture corpus (V0 heuristic baseline)

Generated 2026-09-28T03:01:43+00:00.

Scored with the shipping heuristic engine via `pnpm score`, so these numbers are exactly what the extension computes. Positive class = phishing.

## Dataset

- Rows scored: **20**
- Phishing: **10** · Benign: **10**

## Headline metrics

| Metric | Value |
| --- | --- |
| ROC-AUC | 1.000 |
| PR-AUC | 1.000 |
| FPR @ recall ≥ 0.95 | 0.0% |

## Operating point: MEDIUM (score ≥ 0.35)

| Precision | Recall | F1 | FPR | TP | FP | TN | FN |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 100.0% | 100.0% | 1.000 | 0.0% | 10 | 0 | 10 | 0 |

## Operating point: HIGH (score ≥ 0.75)

| Precision | Recall | F1 | FPR | TP | FP | TN | FN |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 100.0% | 90.0% | 0.947 | 0.0% | 9 | 0 | 10 | 1 |

## Threshold sweep

| Threshold | Precision | Recall | FPR |
| --- | --- | --- | --- |
| 0.00 | 50.0% | 100.0% | 100.0% |
| 0.05 | 50.0% | 100.0% | 100.0% |
| 0.10 | 50.0% | 100.0% | 100.0% |
| 0.15 | 50.0% | 100.0% | 100.0% |
| 0.20 | 50.0% | 100.0% | 100.0% |
| 0.25 | 50.0% | 100.0% | 100.0% |
| 0.30 | 50.0% | 100.0% | 100.0% |
| 0.35 | 100.0% | 100.0% | 0.0% |
| 0.40 | 100.0% | 100.0% | 0.0% |
| 0.45 | 100.0% | 100.0% | 0.0% |
| 0.50 | 100.0% | 100.0% | 0.0% |
| 0.55 | 100.0% | 100.0% | 0.0% |
| 0.60 | 100.0% | 100.0% | 0.0% |
| 0.65 | 100.0% | 100.0% | 0.0% |
| 0.70 | 100.0% | 100.0% | 0.0% |
| 0.75 | 100.0% | 90.0% | 0.0% |
| 0.80 | 100.0% | 70.0% | 0.0% |
| 0.85 | 100.0% | 40.0% | 0.0% |
| 0.90 | 100.0% | 10.0% | 0.0% |
| 0.95 | 0.0% | 0.0% | 0.0% |
| 1.00 | 0.0% | 0.0% | 0.0% |

## Per-row results

| URL | Label | Score | Level |
| --- | --- | --- | --- |
| `http://127.0.0.1:4321/corpus/phish/ip-login.html` | phish | 0.829 | HIGH |
| `http://paypa1-login.test:4321/corpus/phish/external-action.html` | phish | 0.814 | HIGH |
| `http://secure-verify.test:4321/corpus/phish/title-mismatch.html` | phish | 0.938 | HIGH |
| `http://login.example.test:4321/corpus/phish/http-login.html` | phish | 0.726 | MEDIUM |
| `http://account-update.test:4321/corpus/phish/hidden-inputs.html` | phish | 0.797 | HIGH |
| `http://wallet-verify.test:4321/corpus/phish/urgency.html` | phish | 0.876 | HIGH |
| `http://xn--pypal-4ve.paypal.evil.test:4321/corpus/phish/punycode.html` | phish | 0.751 | HIGH |
| `http://secure-login.test:4321/corpus/phish/external-scripts.html` | phish | 0.837 | HIGH |
| `http://paypal-secure.test:4321/corpus/phish/copyright-mismatch.html` | phish | 0.855 | HIGH |
| `http://verify-account.test:4321/corpus/phish/meta-refresh.html` | phish | 0.885 | HIGH |
| `http://example.test:4321/corpus/benign/article-1.html` | benign | 0.316 | LOW |
| `http://example.test:4321/corpus/benign/article-2.html` | benign | 0.316 | LOW |
| `http://example.test:4321/corpus/benign/article-3.html` | benign | 0.316 | LOW |
| `http://example.test:4321/corpus/benign/article-4.html` | benign | 0.316 | LOW |
| `http://example.test:4321/corpus/benign/article-5.html` | benign | 0.316 | LOW |
| `http://example.test:4321/corpus/benign/login-same-origin.html` | benign | 0.316 | LOW |
| `http://bank.example.test:4321/corpus/benign/bank-login.html` | benign | 0.316 | LOW |
| `http://example.test:4321/corpus/benign/account-page.html` | benign | 0.316 | LOW |
| `http://example.test:4321/corpus/benign/contact.html` | benign | 0.316 | LOW |
| `http://example.test:4321/corpus/benign/search.html` | benign | 0.316 | LOW |

## Limitations

- Small-N fixture corpus: treat these numbers as a plumbing smoke test, not a benchmark.
- Zero-day recall requires dated feed data and a temporal split; not reported here.
