const test = require('node:test')
const assert = require('node:assert/strict')
const { load } = require('./helpers.cjs')
const { calculateTasteProfile, calculateMatchScore, scaleToNumber } = load('src/lib/tastePofile.ts')
const { ja } = load('src/i18n/ja.ts')
const { ko } = load('src/i18n/ko.ts')
const record = { wine_type: 'red', body: null, tannin: null, acidity: null, alcohol: null, grape_variety: null, country: null, region: null, score: 8 }
test('Empty or unscored histories do not produce a profile', () => {
  assert.equal(calculateTasteProfile([]), null)
  assert.equal(calculateTasteProfile([{ ...record, score: null }]), null)
})
function keys(value, prefix = '') {
  return Object.entries(value).flatMap(([key, child]) => {
    const full = prefix ? `${prefix}.${key}` : key
    return child && typeof child === 'object' && !Array.isArray(child) ? keys(child, full) : [full]
  }).sort()
}
test('Japanese and Korean dictionaries have matching keys', () => assert.deepEqual(keys(ja), keys(ko)))
for (const [lang, dictionary] of [['ja', ja], ['ko', ko]]) {
  test(`${lang}: every visible palate scale maps to levels 1 through 5`, () => {
    for (const [field, labels] of [['body', dictionary.palate.bodyLevels], ['acidity', dictionary.palate.acidityLevels], ['tannin', dictionary.palate.tanninLevels], ['alcohol', dictionary.palate.alcoholLevels]]) {
      labels.forEach((label, index) => assert.equal(calculateTasteProfile([{ ...record, [field]: label }])[`${field}Score`], (labels.length === 3 ? index * 2 + 1 : index + 1), `${field}: ${label}`))
    }
  })
}
test('Unknown levels stay unknown; relative likes lead the summary without dropping dislikes', () => {
  assert.equal(scaleToNumber('unknown'), null)
  assert.ok(calculateTasteProfile([{ ...record, body: 'full', score: 2 }, { ...record, body: 'light' }]).bodyScore < 1.2)
})
test('No structural information does not produce a misleading score', () => {
  const profile = calculateTasteProfile([record])
  assert.equal(calculateMatchScore(profile, {}).score, null)
})
test('A single wine cannot establish a personalised recommendation', () => {
  const profile = calculateTasteProfile([{ ...record, body: 'full', acidity: 'high', grape_variety: 'シャルドネ' }])
  const result = calculateMatchScore(profile, { body: 5, acidity: 5, grape: 'chardonnay' })
  assert.equal(result.score, null)
  assert.equal(result.evidenceCount, 1)
})

test('Recent preferences outweigh older records without deleting history', () => {
  const recent = Array.from({ length: 30 }, () => ({ ...record, body: 'full', acidity: 'high', score: 9 }))
  const older = Array.from({ length: 100 }, () => ({ ...record, body: 'light', acidity: 'low', score: 9 }))
  const profile = calculateTasteProfile([...recent, ...older])
  assert.ok(profile.bodyScore > 2.4)
  assert.equal(profile.count, 130)
})

test('Simple-mode stars can build a preference profile without a 10-point score', () => {
  const profile = calculateTasteProfile([{ ...record, score: null, stars: 5, body: 'full', acidity: 'high' }])
  assert.equal(profile.avgScore, 5)
  assert.equal(profile.bodyScore, 5)
})
