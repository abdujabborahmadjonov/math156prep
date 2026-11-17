# MATH 156 final prep

A 35 day study site for the MATH 156 final (Nov 17 to Dec 21, 2026).

- **Today**: the session for the day, links to that day's unit or exam, and a 35 square grid
- **Plan**: all 35 days, grouped by phase
- **Units**: for each of the 12 units, an explanation (idea, method, worked example, common mistakes, what the exam asks), an auto-marked quick check, 6 or 7 practice questions with hints and worked solutions, and the unit's formulas
- **Exams**: a Checkpoint test (units 1 to 8), a Probability test (units 9 to 12), Mocks 1 to 3 and a mixed set, each timed and self-marked
- **Progress**: test scores, exam history, unit ratings and the units to focus on next
- **Mistakes**: a log that brings each mistake back until it is solved cleanly twice
- Formula sheet and a standard normal table

Plain HTML, CSS and JavaScript with no build step. The plan is in `data.js`, questions and exams in `questions.js`, explanations and quick checks in `lessons.js`.
Maths is typeset with KaTeX (bundled in `vendor/katex`, MIT licence). All questions were written for this plan and every answer was checked with SymPy.
Progress is stored in the browser (localStorage); the footer has backup and restore.
