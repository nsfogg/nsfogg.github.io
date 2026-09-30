// Suggests a category from a document's title and extracted text.

const HINTS = [
  ['Insurance', /\b(insurance|insured|insurer|policy (number|no|#)|premium|deductible|coverage|policyholder|beneficiary)\b/g],
  ['Medical', /\b(patient|diagnosis|prescription|medical|clinic|hospital|physician|explanation of benefits|immunization|vaccination|lab results?)\b/g],
  ['Tax', /\b(irs|w-2|w2|1099|1098|tax return|form 1040|withholding|taxable)\b/g],
  ['Financial', /\b(bank|statement period|account (number|summary)|balance|credit card|loan|mortgage|investment|401\(?k\)?|ira|brokerage)\b/g],
  ['Military', /\b(hpsp|army|navy|air force|marine corps|space force|dod|military|dd ?214|dd form|commission(ing)?|uniformed services)\b/g],
  ['Vehicle', /\b(vehicle|vin|registration|dmv|odometer|motor vehicles?)\b/g],
  ['Housing', /\b(lease|landlord|tenant|deed|hoa|homeowners association|rent|property tax|escrow)\b/g],
  ['Identity', /\b(passport|birth certificate|social security (card|number)|driver'?s license|identification card|naturalization)\b/g],
  ['Legal', /\b(attorney|court|plaintiff|defendant|power of attorney|notary|notarized|last will|testament|affidavit)\b/g],
  ['Education', /\b(transcript|diploma|university|college|tuition|student loan|enrollment|degree)\b/g],
  ['Employment', /\b(employer|offer letter|pay ?stub|payroll|employment|earnings statement|w-4)\b/g],
  ['Receipts', /\b(receipt|order (number|#)|invoice|subtotal|amount paid|thank you for your purchase)\b/g],
];

export function suggestCategory(title, text) {
  const hay = `${title || ''}\n${title || ''}\n${(text || '').slice(0, 20000)}`.toLowerCase();
  let best = null;
  let bestScore = 0;
  for (const [category, re] of HINTS) {
    const score = (hay.match(re) || []).length;
    if (score > bestScore) {
      best = category;
      bestScore = score;
    }
  }
  return best;
}
