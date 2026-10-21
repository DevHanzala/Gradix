# Translation review

All Urdu, Arabic and Persian strings were written by the developer (AI-assisted), not by a
professional translator. They are complete (`npm run i18n:check` enforces key parity and matching
`{{placeholders}}`), but a native speaker should review them before production. The items below are
the ones we are least sure about, or that involve a deliberate terminology choice.

Catalogs: `frontend/src/locales/<lang>/<area>.json` (UI) and `backend/locales/<lang>.json` (emails,
notifications).

## Terminology choices (all languages)

| Concept | Urdu | Arabic | Persian | Note |
|---|---|---|---|---|
| Assessment | امتحان | تقييم | آزمون | Urdu "امتحان" = exam; "جانچ" was considered. Arabic uses تقييم (assessment), not اختبار (test). |
| Learning objective | تعلیمی مقصد | هدف تعليمي | هدف آموزشی | |
| Question bank | سوالیہ بینک | بنك الأسئلة | بانک پرسش | |
| Rubric | معیارِ جانچ | معيار التصحيح | معیار تصحیح | Educators may prefer "روبرک" (Urdu/Persian loanword). |
| Adaptive difficulty | موافق مشکل | صعوبة تكيفية | دشواری تطبیقی | Urdu wording is unusual; "خود کار مشکل" or "متغیر مشکل" may read better. |
| Publish | شائع کریں | نشر | انتشار | |
| Enroll | شامل کریں | تسجيل | ثبت‌نام | Urdu "داخلہ" is an alternative. |
| Negative marking | منفی مارکنگ | الدرجات السالبة | نمره منفی | Urdu keeps the English loanword "مارکنگ", common in Pakistan. |
| Super Admin | اعلیٰ منتظم | المسؤول الأعلى | مدیر ارشد | |
| Instructor | استاد | مدرّس | مدرس | |

## Uncertain strings

- **ur `bank.levels` (یاد / سمجھ / اطلاق / تجزیہ / جانچ)**: Bloom's levels; Pakistani curricula use
  "علم، فہم، اطلاق، تجزیہ، تالیف، جائزہ". Consider aligning.
- **ar `analytics.answersSummary` ("صحيح: {{correct}} · {{score}}")**: reordered to avoid number
  agreement problems with "صحيحة/صحيح".
- **ar, all count strings**: written as "Label: {{count}}" to avoid Arabic dual/plural agreement
  (i18next plural keys were deliberately not used). A reviewer may want natural plural forms.
- **ur `objectives.slot` / `bank.objectiveShort` (س / م)** and **ar (س / هـ)**, **fa (پ / ه)**:
  one-letter abbreviations for Question/Objective in the question plan; check they are recognisable.
- **fa digits**: Persian strings use Persian digits (۸، ۱۰…) in prose; numbers inserted at runtime are
  formatted by `Intl` for `fa-IR` (also Persian digits). Timers deliberately keep Latin digits.
- **Email greetings**: Urdu uses "السلام علیکم {{name}}،"; a more neutral "محترم {{name}}،" may be
  preferred for institutional mail.
- **`common.recaptchaNotice`**: legal wording of Google's notice; Google publishes official
  translations that should replace ours.
- **`paper.*`**: carried over unchanged from Phase 1 (`utils/translations.js`); not re-reviewed.

## Not translated on purpose

- Product name "Gradix", "Google", "reCAPTCHA", file-format names (PDF, Word, PowerPoint).
- Proper nouns in printed-paper headers (institute, teacher, subject names) are printed as typed.
- Question content comes from the generator in the student's language; it is not translated.
