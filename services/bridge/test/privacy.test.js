// The privacy word checks that run even when the AI is off.
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { findPrivacyFlags } = require('../src/privacy');

describe('findPrivacyFlags', () => {
  it('a clean need card has no warnings', () => {
    assert.deepEqual(findPrivacyFlags('12 students of class 6 to 8 want help reading English aloud, Saturday mornings at the government school in Kanchipuram'), []);
    assert.deepEqual(findPrivacyFlags(JSON.stringify(require('../src/fallbackDraft.json'))), []);
  });

  it('money in every common spelling', () => {
    for (const text of ['income is 5000', 'Rs 5000', 'Rs. 5000', 'rs.5000', '₹5000', 'five thousand rupees', 'salary', 'INR 400'])
      assert.deepEqual(findPrivacyFlags(text), ['Mentions money or income'], text);
  });

  it('caste or religion', () => {
    for (const text of ['their caste', 'Muslim family', 'a Hindu temple', 'religion'])
      assert.ok(findPrivacyFlags(text).includes('Mentions caste or religion'), text);
  });

  it('a health detail', () => {
    for (const text of ['has TB', 'HIV positive', 'disabled child', 'a long illness'])
      assert.ok(findPrivacyFlags(text).includes('Mentions a health detail'), text);
  });

  it('words we avoid', () => {
    for (const text of ['poor boy', 'needy families', 'the beneficiaries', 'Beneficiary list'])
      assert.ok(findPrivacyFlags(text).includes('Uses a word we avoid about the people served'), text);
  });

  it("a person's age", () => {
    for (const text of ['she is 9 years old', 'a 10-year-old', 'aged 7', 'age 12'])
      assert.ok(findPrivacyFlags(text).includes("Mentions a person's age"), text);
  });

  it('does not fire inside other words', () => {
    assert.deepEqual(findPrivacyFlags('pages 12, brushes, therapy-free, poorly lit hall? no: classrooms, hrs, stb'), []);
  });

  it('several problems give several warnings, each once', () => {
    const flags = findPrivacyFlags("Ravi, a poor boy, father's income is Rs 5000, poor family");
    assert.equal(flags.length, 2);
  });
});
