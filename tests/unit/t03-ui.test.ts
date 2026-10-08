import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM, VirtualConsole } from 'jsdom';

function screen() {
  const errors: Error[] = [];
  const console = new VirtualConsole(); console.on('jsdomError', error => errors.push(error));
  const dom = new JSDOM(readFileSync('artifacts/T03/hotel-price-simulation.html', 'utf8'), {
    runScripts: 'dangerously', virtualConsole: console,
    beforeParse(window) { window.structuredClone = structuredClone; },
  });
  const doc = dom.window.document;
  const input = (name: string, value: string) => {
    const node = doc.querySelector<HTMLInputElement>(`[data-field="${name}"]`)!;
    node.value = value; node.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
  };
  const button = doc.querySelector<HTMLButtonElement>('[data-action="calculate"]')!;
  const results = doc.querySelector<HTMLElement>('[data-part="results"]')!;
  const text = (metric: string) => doc.querySelector(`[data-value="${metric}"]`)!.textContent;
  return { dom, doc, input, button, results, text, errors };
}
test('Ekran ilk açılışta referans hesabını ve iki grafiği gösterir', () => {
  const s = screen();
  try {
    assert.deepEqual(s.errors, []);
    assert.equal(s.results.hidden, false);
    assert.equal(s.text('revpar'), '79,75 USD');
    assert.equal(s.doc.querySelectorAll('path[data-series]').length, 2);
    assert.equal(s.doc.querySelectorAll('svg circle').length, 2);
  } finally { s.dom.window.close(); }
});
test('Girdi değişimi eski sonucu gizler; hesapla yeni sonucu üretir', () => {
  const s = screen();
  try {
    s.input('selectedAdr', '141,25');
    assert.equal(s.results.hidden, true);
    s.button.click();
    assert.equal(s.results.hidden, false);
    assert.equal(s.text('occupancy'), '%56,50');
    assert.equal(s.text('revpar'), '79,81 USD');
    assert.deepEqual(s.errors, []);
  } finally { s.dom.window.close(); }
});
test('Eksik veri hesaplamayı engeller ve açıklanır', () => {
  const s = screen();
  try {
    s.input('minAdr', '');
    assert.ok(s.button.disabled);
    assert.ok(s.results.hidden);
    assert.ok(s.doc.querySelector('[data-part="errors"]')!.textContent?.includes('en düşük fiyat'));
  } finally { s.dom.window.close(); }
});
test('Geçersiz yüzde ve fiziksel model hesaplamayı engeller', () => {
  const s = screen();
  try {
    s.input('referenceOccupancy', '110'); assert.ok(s.button.disabled);
    s.input('referenceOccupancy', '99'); assert.ok(s.button.disabled);
    s.input('referenceOccupancy', '55'); assert.equal(s.button.disabled, false);
  } finally { s.dom.window.close(); }
});
test('Minimum doluluk ihlali hesapta açıkça gösterilir', () => {
  const s = screen();
  try {
    s.input('minOccupancy', '60'); s.button.click();
    assert.equal(s.results.hidden, false);
    assert.ok(s.doc.querySelector('[data-part="constraint"]')!.textContent?.includes('karşılamıyor'));
    s.input('minOccupancy', '70');
    assert.ok(s.doc.querySelector('[data-part="warnings"]')!.textContent?.includes('hiçbir fiyat'));
    assert.equal(s.button.disabled, false);
  } finally { s.dom.window.close(); }
});
test('Nokta modeline geçiş hesapları değiştirir; yanlış nokta reddedilir', () => {
  const s = screen();
  try {
    s.input('model', 'scenario-points');
    assert.ok(s.doc.querySelector<HTMLElement>('[data-part="linear"]')!.hidden);
    assert.equal(s.doc.querySelector<HTMLElement>('[data-part="points"]')!.hidden, false);
    s.input('selectedAdr', '130'); s.button.click();
    assert.equal(s.text('revpar'), '84,50 USD');
    s.input('points', '130;65\n130;50'); assert.ok(s.button.disabled);
    s.input('points', '130,65'); assert.ok(s.button.disabled);
    assert.deepEqual(s.errors, []);
  } finally { s.dom.window.close(); }
});
test('Slider canlı hesaplar; analiz dışı elle girilen fiyat sonuç üretmez', () => {
  const s = screen();
  try {
    const slider = s.doc.querySelector<HTMLInputElement>('[data-action="slider"]')!;
    slider.value = '150'; slider.dispatchEvent(new s.dom.window.Event('input', { bubbles: true }));
    assert.equal(s.text('revpar'), '79,50 USD');
    s.input('selectedAdr', '160'); s.button.click();
    assert.ok(s.results.hidden);
    assert.ok(s.doc.querySelector('[data-part="errors"]')!.textContent?.includes('aralığının dışında'));
  } finally { s.dom.window.close(); }
});
test('Para birimi etiketi yenilenir; metin girdisi kod olarak yorumlanmaz', () => {
  const s = screen();
  try {
    s.input('currency', 'TRY'); s.input('name', '<script>alert(1)</script>'); s.button.click();
    assert.equal(s.text('revpar'), '79,75 TRY');
    assert.deepEqual(s.errors, []);
  } finally { s.dom.window.close(); }
});
