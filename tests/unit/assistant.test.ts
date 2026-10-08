import {test} from 'node:test';
import assert from 'node:assert/strict';
import {requestAssistantProposal} from '../../src/domain/guide/ai-assistant.adapter.ts';
test('AI önerisi doğrulanır ve kullanıcı onayı ister; hesaplama başlatmaz',async()=>{const result=await requestAssistantProposal(async()=>({suggestedTool:'max-revpar',explanation:'Fiyat aralığını ve talep modelini belirleyin.',questions:['Talep modeli var mı?']}),'fiyat belirlemek',[],['max-revpar']);assert.ok(result.success);assert.equal(result.value.needsUserApproval,true);});
test('AI sayısal varsayım ve izinsiz aracı probleme ekleyemez',async()=>{for(const response of [{suggestedTool:'max-revpar',explanation:'x',questions:[],optimalAdr:999},{suggestedTool:'max-npv',explanation:'x',questions:[]}])assert.equal((await requestAssistantProposal(async()=>response,'fiyat',[],['max-revpar'])).success,false);});
test('AI sağlayıcı hatası deterministik akışı durdurmaz',async()=>{const result=await requestAssistantProposal(async()=>{throw Error('offline');},'fiyat',[],['max-revpar']);assert.equal(result.success,false);if(!result.success)assert.equal(result.issues[0].code,'ASSISTANT_UNAVAILABLE');});
