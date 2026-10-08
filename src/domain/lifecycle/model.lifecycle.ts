import { attempt, FinancialInputError } from '../skills/financial.skills.ts';
import type { SkillResult } from '../skills/skill.types.ts';
export type LifecycleState='DRAFT'|'VALIDATED'|'LOCKED'|'BLUEPRINT';
export type ModelLifecycle=Readonly<{modelId:string;version:string;state:LifecycleState;evidence:readonly string[];acceptance?:Readonly<{by:string;date:string;reason:string}>}>;
export function createModelDraft(modelId:string,version:string):SkillResult<ModelLifecycle>{return attempt(()=>{if(!modelId.trim()||!version.trim())throw new FinancialInputError('REQUIRED_FIELD','model','Model kimliği ve sürümü gerekli.');return Object.freeze({modelId,version,state:'DRAFT',evidence:Object.freeze([])});});}
export function validateModelLifecycle(model:ModelLifecycle,checks:Readonly<{math:boolean;finance:boolean;ux:boolean;logic:boolean;evidence:readonly string[]}>):SkillResult<ModelLifecycle>{return attempt(()=>{
  if(model.state!=='DRAFT'||![checks.math,checks.finance,checks.ux,checks.logic].every(value=>value===true)||!checks.evidence.length||checks.evidence.some(path=>typeof path!=='string'||!path.trim()))throw new FinancialInputError('VALIDATION_INCOMPLETE','lifecycle','DRAFT model ve matematik, finans, UX, mantık kanıtları gerekli.');
  return Object.freeze({...model,state:'VALIDATED',evidence:Object.freeze([...checks.evidence])});});}
export function lockModelLifecycle(model:ModelLifecycle,acceptance:Readonly<{by:string;date:string;reason:string}>):SkillResult<ModelLifecycle>{return attempt(()=>{
  const date=new Date(`${acceptance.date}T00:00:00Z`);
  if(model.state!=='VALIDATED'||!acceptance.by.trim()||!acceptance.reason.trim()||!/^\d{4}-\d{2}-\d{2}$/.test(acceptance.date)||!Number.isFinite(date.getTime())||date.toISOString().slice(0,10)!==acceptance.date)throw new FinancialInputError('LOCK_NOT_APPROVED','lifecycle','LOCK için doğrulanmış model ve açık kabul kaydı gerekli.');
  return Object.freeze({...model,state:'LOCKED',acceptance:Object.freeze({...acceptance})});});}
export function incorporateBlueprint(model:ModelLifecycle,blueprintEvidence:string):SkillResult<ModelLifecycle>{return attempt(()=>{
  if(model.state!=='LOCKED'||!blueprintEvidence.trim())throw new FinancialInputError('MODEL_NOT_LOCKED','lifecycle','Blueprint’e yalnız kilitlenmiş model alınabilir.');
  return Object.freeze({...model,state:'BLUEPRINT',evidence:Object.freeze([...model.evidence,blueprintEvidence])});});}
