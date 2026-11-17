# MATH 156 final prep

A 35 day study tracker for the MATH 156 final (Nov 17 to Dec 21, 2026).

- **Today**: the session for the day and one button to mark it done
- **Plan**: all 35 days, grouped by phase
- **Practice**: 36 exam style questions with worked solutions, two timed mock exams plus a mixed set, and a formula sheet
- **Progress**: test scores and a red, yellow or green rating for each of the 12 units
- **Mistakes**: a log that brings each mistake back until it is solved cleanly twice

Plain HTML, CSS and JavaScript with no build step. The plan lives in `data.js` and the questions in `questions.js`.
Maths is typeset with KaTeX (bundled in `vendor/katex`, MIT licence). The questions are original; units 4 to 8 link out to the CLP-3 textbook for more problems.
Progress is stored in the browser (localStorage); use the backup links in the footer to move it between devices.
