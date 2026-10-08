import type { RevparSolution } from '../solvers/max-revpar.solver.ts';
import { calculateRevpar } from '../skills/revpar.skill.ts';
import { compileDemand } from '../skills/demand.skill.ts';
import { validateCandidate } from '../constraints/constraint.validator.ts';

const number = (value: number) => value.toLocaleString('tr-TR', { maximumFractionDigits: 4 });
export function explainRevparResult(result: RevparSolution) {
  if (result.status !== 'OPTIMAL') return { title: result.status === 'INFEASIBLE' ? 'Uygulanabilir fiyat yok' : 'Problem hesaplanamadı', messages: result.issues.map(issue => issue.message) };
  const snapshot = result.inputSnapshot.caseSnapshot;
  const roundedAdr = Number(result.optimalAdr.toFixed(2));
  const compiled = compileDemand(snapshot);
  const applicationOccupancy = compiled.success ? compiled.value.occupancyAt(roundedAdr) : undefined;
  const applicationRevpar = applicationOccupancy?.success ? calculateRevpar(roundedAdr, applicationOccupancy.value) : undefined;
  const constraints = applicationOccupancy?.success ? validateCandidate(roundedAdr, applicationOccupancy.value, { minAdr: snapshot.minAdr, maxAdr: snapshot.maxAdr, minOccupancy: snapshot.minOccupancy }) : undefined;
  const reference = snapshot.referenceAdr !== undefined && snapshot.referenceOccupancy !== undefined ? calculateRevpar(snapshot.referenceAdr, snapshot.referenceOccupancy) : undefined;
  return {
    title: 'Talep varsayımı altında en yüksek RevPAR',
    messages: [
      `${number(result.optimalAdr)} ${snapshot.currency} ADR → %${number(result.expectedOccupancy * 100)} doluluk → ${number(result.maximumRevpar)} ${snapshot.currency} RevPAR.`,
      reference?.success ? `Baz RevPAR ${number(reference.value)}; mutlak fark ${number(result.maximumRevpar - reference.value)} ${snapshot.currency}.` : 'Referans ölçüm verilmedi; baz karşılaştırması yapılmadı.',
      result.bindingConstraints.length ? `Aktif sınırlar: ${result.bindingConstraints.join(', ')}.` : 'Optimum fiyat aralığının içinde; aktif sınır yok.',
      'Sonuç belirtilen talep modeli ve kısıtlar altında hesaplanmıştır. Gerçekleşecek talebi garanti etmez; NOI veya kâr optimumu değildir.',
    ],
    delta: reference?.success ? { absolute: result.maximumRevpar - reference.value, relative: reference.value === 0 ? null : (result.maximumRevpar - reference.value) / reference.value } : null,
    application: { adr: roundedAdr, occupancy: applicationOccupancy?.success ? applicationOccupancy.value : null,
      revpar: applicationRevpar?.success ? applicationRevpar.value : null, feasible: constraints?.valid ?? false },
    usedAssumptions: snapshot, versions: { problem: result.inputSnapshot.problemVersion, demand: snapshot.demand.modelVersion, calculation: result.inputSnapshot.calculationVersion, solver: result.inputSnapshot.solverVersion, numerical: result.inputSnapshot.numericalPolicyVersion },
  };
}
