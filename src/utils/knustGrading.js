// KNUST-style letter grade bands (for display only — CWA itself is the raw
// credit-weighted percentage average, not a converted letter/point scale).
const LETTER_BANDS = [
  { min: 80, letter: 'A+' },
  { min: 75, letter: 'A' },
  { min: 70, letter: 'A-' },
  { min: 65, letter: 'B+' },
  { min: 60, letter: 'B' },
  { min: 55, letter: 'B-' },
  { min: 50, letter: 'C+' },
  { min: 45, letter: 'C' },
  { min: 40, letter: 'D' },
  { min: 0, letter: 'F' },
];

function scoreToLetter(score) {
  const s = Number(score);
  for (const band of LETTER_BANDS) {
    if (s >= band.min) return band.letter;
  }
  return 'F';
}

// KNUST degree classification bands, based on final CWA.
const CLASS_BANDS = [
  { min: 70, label: 'First Class' },
  { min: 60, label: 'Second Class Upper' },
  { min: 50, label: 'Second Class Lower' },
  { min: 40, label: 'Third Class / Pass' },
  { min: 0, label: 'Fail' },
];

function cwaToClassification(cwa) {
  const c = Number(cwa);
  for (const band of CLASS_BANDS) {
    if (c >= band.min) return band.label;
  }
  return 'Fail';
}

module.exports = { scoreToLetter, cwaToClassification };