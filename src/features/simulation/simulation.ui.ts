import { parseNumericInput, percentageToRatio } from '../../domain/numerics/numerical-policy.ts';
import { checkMaxRevparReadiness } from '../../domain/readiness/readiness.engine.ts';
import type { ReadinessResult } from '../../domain/readiness/readiness.engine.ts';
import { simulatePrice } from '../../domain/simulation/simulate-price.ts';
import type { SimulationResult } from '../../domain/simulation/simulate-price.ts';

const root = document.getElementById('hdse-price-simulation')!;
const field = (name: string) => root.querySelector<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(`[data-field="${name}"]`)!;
const part = (name: string) => root.querySelector<HTMLElement>(`[data-part="${name}"]`)!;
const button = root.querySelector<HTMLButtonElement>('[data-action="calculate"]')!;
const slider = root.querySelector<HTMLInputElement>('[data-action="slider"]')!;
const format = (n: number) => n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
let displayed: SimulationResult | undefined;
let revision = 0;

function readInput() {
  const parsingIssues: string[] = [];
  const number = (key: string, percent = false) => {
    try {
      const n = parseNumericInput(field(key).value);
      return percent && n !== undefined ? percentageToRatio(n) : n;
    } catch { parsingIssues.push(`${field(key).parentElement?.textContent?.trim()}: geçerli ${percent ? '0–100 arasında yüzde' : 'sayı'} girin.`); return undefined; }
  };
  const model = field('model').value;
  let demand: unknown;
  let referenceAdr: number | undefined;
  let referenceOccupancy: number | undefined;
  if (model === 'linear-sensitivity') {
    referenceAdr = number('referenceAdr'); referenceOccupancy = number('referenceOccupancy', true);
    demand = { kind: model, modelVersion: 'demand.v1', adrIncrease: number('adrIncrease'), occupancyDecreasePp: number('occupancyDecreasePp'), validMinAdr: number('validMinAdr'), validMaxAdr: number('validMaxAdr') };
  } else {
    const text = field('points').value.trim();
    const points = text ? text.split('\n').filter(line => line.trim()).map((line, i) => {
      const cells = line.split(';');
      try {
        if (cells.length !== 2) throw new Error();
        const adr = parseNumericInput(cells[0]); const percent = parseNumericInput(cells[1]);
        if (adr === undefined || percent === undefined) throw new Error();
        return { adr, occupancy: percentageToRatio(percent) };
      } catch { parsingIssues.push(`Senaryo noktası ${i + 1}: fiyat; doluluk (%) biçiminde iki geçerli sayı girin.`); return { adr: NaN, occupancy: NaN }; }
    }) : undefined;
    demand = { kind: model, modelVersion: 'demand.v1', points };
  }
  const input = { schemaVersion: 'case.v1', id: 'simulation-case', revision, name: field('name').value, currency: field('currency').value,
    period: { start: field('start').value, end: field('end').value }, minAdr: number('minAdr'), maxAdr: number('maxAdr'), minOccupancy: number('minOccupancy', true),
    referenceAdr, referenceOccupancy, demand };
  const selectedAdr = number('selectedAdr');
  return { input, selectedAdr, parsingIssues };
}
function lines(element: HTMLElement, messages: readonly string[]) {
  element.replaceChildren(...messages.map(message => { const line = document.createElement('div'); line.textContent = message; return line; }));
}
function showReadiness(readiness: ReadinessResult, parsingIssues: string[], selectedAdr?: number) {
  const ready = readiness.status === 'READY' && !parsingIssues.length && selectedAdr !== undefined;
  button.disabled = !ready;
  lines(part('errors'), [...parsingIssues, ...readiness.missingFields.map(f => f.reason), ...readiness.issues.map(i => `${i.message} ${i.remediation}`), ...(selectedAdr === undefined ? ['Denenecek ADR gerekli.'] : [])]);
  lines(part('warnings'), readiness.warnings.map(w => w.message));
  part('status').textContent = parsingIssues.length ? 'Geçersiz giriş — hesaplama engellendi.' : readiness.status === 'READY' ? 'Veri hazır.' : readiness.status === 'INCOMPLETE' ? 'Eksik bilgiler var — hesaplama engellendi.' : 'Veri düzeltmesi gerekli — hesaplama engellendi.';
  const snapshot = readiness.caseSnapshot;
  slider.disabled = !snapshot || !ready;
  if (snapshot) {
    slider.min = String(snapshot.minAdr); slider.max = String(snapshot.maxAdr);
    slider.disabled ||= snapshot.minAdr === snapshot.maxAdr;
    if (selectedAdr !== undefined) slider.value = String(selectedAdr);
  }
}
function refresh(calculate = false) {
  const isLinear = field('model').value === 'linear-sensitivity';
  part('linear').hidden = !isLinear; part('points').hidden = isLinear;
  const { input, selectedAdr, parsingIssues } = readInput();
  const readiness = checkMaxRevparReadiness(input);
  showReadiness(readiness, parsingIssues, selectedAdr);
  displayed = undefined;
  part('results').hidden = true;
  part('constraint').textContent = '';
  if (!calculate) {
    if (readiness.status === 'READY' && !parsingIssues.length) part('status').textContent += ' Girdiler değişti; yeniden hesaplayın.';
    return;
  }
  if (button.disabled || selectedAdr === undefined) return;
  const result = simulatePrice(input, selectedAdr);
  if (result.issues.length || !result.selected) { lines(part('errors'), result.issues.map(i => i.message)); return; }
  displayed = result;
  part('results').hidden = false;
  const selected = result.selected;
  for (const [metric, text] of Object.entries({ adr: `${format(selected.adr)} ${input.currency}`, occupancy: `%${format(selected.occupancy * 100)}`, revpar: `${format(selected.revpar)} ${input.currency}` })) {
    root.querySelector<HTMLElement>(`[data-value="${metric}"]`)!.textContent = text;
  }
  part('status').textContent = 'Simülasyon güncel.';
  part('constraint').textContent = selected.feasible ? 'Seçilen fiyat kısıtları karşılıyor.' : 'Seçilen fiyat kısıtı karşılamıyor: ' + selected.constraints.issues.map(i => i.message).join(' ');
  drawCharts();
}

const svgNs = 'http://www.w3.org/2000/svg';
function node(tag: string, attrs: Record<string, string | number>, text?: string) {
  const element = document.createElementNS(svgNs, tag);
  for (const [key, value] of Object.entries(attrs)) element.setAttribute(key, String(value));
  if (text) element.textContent = text;
  return element;
}
function drawCharts() {
  if (!displayed?.selected || !displayed.curve?.length) return;
  const points = displayed.curve;
  for (const metric of ['occupancy', 'revpar'] as const) {
    const svg = root.querySelector<SVGSVGElement>(`[data-chart="${metric}"]`)!;
    const width = Math.max(280, svg.getBoundingClientRect().width || root.getBoundingClientRect().width || 736);
    const height = 205; const left = 70; const right = width - 18; const top = 12; const bottom = 154;
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    const minP = points[0].adr; const maxP = points.at(-1)!.adr;
    const factor = metric === 'occupancy' ? 100 : 1;
    const values = points.map(point => point[metric] * factor);
    const minimum = Math.min(...values); const maximum = Math.max(...values);
    const padding = Math.max((maximum - minimum) * .15, maximum === 0 ? 1 : Math.abs(maximum) * .005);
    const low = Math.max(0, minimum - padding); const high = maximum + padding;
    const x = (price: number) => minP === maxP ? (left + right) / 2 : left + (price - minP) / (maxP - minP) * (right - left);
    const y = (v: number) => bottom - (v - low) / (high - low) * (bottom - top);
    const oldPath = svg.querySelector('path[data-series]')?.getAttribute('d');
    svg.replaceChildren();
    svg.append(node('title', {}, `${metric === 'occupancy' ? 'Doluluk' : 'RevPAR'} — seçilen ADR ${format(displayed.selected.adr)}`));
    svg.append(node('rect', { x: left, y: top, width: right - left, height: bottom - top, fill: 'none', stroke: 'var(--border)' }));
    const tickCount = width < 400 ? 2 : 3;
    for (let i = 0; i <= tickCount; i++) {
      const v = low + (high - low) * i / tickCount;
      svg.append(node('line', { x1: left, x2: right, y1: y(v), y2: y(v), stroke: 'var(--border)' }));
      svg.append(node('text', { x: left - 7, y: y(v) + 4, 'text-anchor': 'end', class: 'text-small' }, format(v)));
      if (minP !== maxP || i === 0) {
        const p = minP === maxP ? minP : minP + (maxP - minP) * i / tickCount;
        svg.append(node('text', { x: x(p), y: bottom + 20, 'text-anchor': i === 0 && minP !== maxP ? 'start' : i === tickCount ? 'end' : 'middle', class: 'text-small' }, format(p)));
      }
    }
    svg.append(node('text', { x: (left + right) / 2, y: height - 7, 'text-anchor': 'middle', class: 'text-small' }, `ADR (${field('currency').value})`));
    svg.append(node('text', { transform: `translate(15 ${(top + bottom) / 2}) rotate(-90)`, 'text-anchor': 'middle', class: 'text-small' }, metric === 'occupancy' ? 'Doluluk (%)' : `RevPAR (${field('currency').value})`));
    const d = points.map((point, i) => `${i ? 'L' : 'M'}${x(point.adr)},${y(point[metric] * factor)}`).join(' ');
    const path = node('path', { d, fill: 'none', stroke: 'var(--viz-series-1)', 'stroke-width': 2, 'data-series': metric });
    svg.append(path);
    if (oldPath && oldPath.split('L').length === d.split('L').length && !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      const animation = node('animate', { attributeName: 'd', from: oldPath, to: d, dur: '.2s', fill: 'freeze' }); path.append(animation);
      (animation as SVGAnimateElement).beginElement?.();
    }
    const selected = displayed.selected;
    svg.append(node('circle', { cx: x(selected.adr), cy: y(selected[metric] * factor), r: 5, fill: 'var(--viz-series-1)', 'data-tooltip': `${format(selected.adr)} ${field('currency').value} → ${format(selected[metric] * factor)} ${metric === 'occupancy' ? '%' : field('currency').value}` }));
  }
}

type HostWindow = Window & { openai?: { widgetState?: { privateContent?: { fields?: Record<string, string> } }; setWidgetState?: (state: unknown) => Promise<unknown> } };
const host = window as HostWindow;
function restore(fields?: Record<string, string>) {
  if (!fields) return;
  root.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('[data-field]').forEach(input => {
    const value = fields[input.dataset.field!]; if (typeof value === 'string') input.value = value;
  });
}
function save() {
  const fields = Object.fromEntries([...root.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('[data-field]')].map(input => [input.dataset.field!, input.value]));
  host.openai?.setWidgetState?.({ modelContent: { model: fields.model, selectedAdr: fields.selectedAdr, currency: fields.currency }, privateContent: { fields } }).catch(() => {});
}
root.addEventListener('input', event => {
  if (!(event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement || event.target instanceof HTMLTextAreaElement)) return;
  revision++;
  if (event.target === slider) { field('selectedAdr').value = slider.value; refresh(true); }
  else refresh();
  save();
});
button.addEventListener('click', () => { refresh(true); save(); });
window.addEventListener('openai:set_globals', event => {
  const state = (event as CustomEvent).detail?.globals?.widgetState;
  if (state?.privateContent?.fields) { restore(state.privateContent.fields); refresh(); }
});
if (typeof ResizeObserver !== 'undefined') new ResizeObserver(drawCharts).observe(root);
restore(host.openai?.widgetState?.privateContent?.fields);
refresh(true);
