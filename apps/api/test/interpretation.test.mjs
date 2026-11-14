import assert from 'node:assert/strict';
import test from 'node:test';
import { createChat, searchInterpreted } from '../dist/chat.js';
import { AppError } from '../dist/errors.js';

const cable = { id:'c1', name:'Cable HDMI', brand:'Marca', description:null, specifications:{}, categories:[{id:'1',name:'Cables'}], sku:{id:'s1',name:null,price:30,listPrice:null,stock:2,images:[],sellerName:null} };
const input = { message:'El monitor pierde imagen al mover el cable conectado a la computadora. ¿Qué cable me recomiendas?', history:[] };
const interpretation = { need:'Reemplazar el cable de video del monitor', queries:['cable de video para monitor','cable HDMI'], assumptions:['El cable podría ser HDMI'] };

test('interpreta un relato, busca con dos consultas y deduplica productos', async () => {
  const queries = [];
  const result = await searchInterpreted(async (args, assumptions) => { queries.push({args, assumptions}); return [cable]; }, interpretation);
  assert.deepEqual(queries.map(({args}) => args.text), interpretation.queries);
  assert.ok(queries.every(({assumptions}) => assumptions[0] === 'El cable podría ser HDMI'));
  assert.deepEqual(result, [cable]);
});

test('la hipótesis acompaña solo productos recuperados y los filtros no expresados se eliminan', async () => {
  const queries = [], emitted = [];
  const chat = createChat(async (query) => { queries.push(query); return [cable]; }, async (_input, search, propose) => {
    await searchInterpreted(search, {...interpretation, filters:{brand:'Inventada', maxPrice:100}});
    assert.equal(propose({productId:'inventado',evidence:{field:'name',value:'Cable HDMI'}}), false);
    assert.equal(propose({productId:'c1',evidence:{field:'name',value:'Cable HDMI'}}), true);
    return {recommendations:[]};
  });
  const result = await chat(input, item => emitted.push(item));
  assert.equal(result.status, 'ok');
  assert.deepEqual(queries, [{text:'cable de video para monitor'}, {text:'cable HDMI'}]);
  assert.deepEqual(emitted[0].assumptions, ['El cable podría ser HDMI']);
});

test('avisa si el tipo de conector es inferido aunque el modelo no lo declare', async () => {
  const chat = createChat(async () => [cable], async (_input, search, propose) => {
    await searchInterpreted(search,{need:'Cable de video',queries:['cable HDMI'],assumptions:[]});
    propose({productId:'c1',evidence:{field:'name',value:'Cable HDMI'}});
    return {recommendations:[]};
  });
  const result = await chat(input);
  assert.deepEqual(result.recommendations[0].assumptions,['El conector HDMI no fue confirmado']);
  const confirmed = await chat({message:'Necesito un cable HDMI',history:[]});
  assert.equal(confirmed.recommendations[0].assumptions,undefined);
});

test('respeta el conector corregido y conserva filtros explícitos', async () => {
  const history = [{role:'user',text:'Necesito un cable HDMI de hasta 100 soles'}, {role:'assistant',text:'¿Para qué equipo?'}];
  const displayPort = {...cable, id:'dp1', name:'Cable DisplayPort'};
  const actual = [];
  const chat = createChat(async query => {actual.push(query);return [cable, displayPort];}, async (_input,search,propose) => {
    await searchInterpreted(search,{need:'Cable DisplayPort para monitor',queries:['cable DisplayPort'],assumptions:[],filters:{maxPrice:100}});
    assert.equal(propose({productId:'c1',evidence:{field:'name',value:'Cable HDMI'}}),false);
    assert.equal(propose({productId:'dp1',evidence:{field:'name',value:'Cable DisplayPort'}}),true);
    return {recommendations:[]};
  });
  const result = await chat({message:'Me equivoqué, es DisplayPort',history});
  assert.deepEqual(actual,[{text:'cable DisplayPort',maxPrice:100}]);
  assert.deepEqual(result.recommendations.map(item=>item.name),['Cable DisplayPort']);
});

test('rechaza interpretaciones inválidas y propaga errores de búsqueda', async () => {
  for (const invalid of [{...interpretation,queries:[]},{...interpretation,queries:['a','b','c']},{...interpretation,assumptions:['x'.repeat(81)]},{...interpretation,sql:'DELETE'}]) {
    await assert.rejects(searchInterpreted(async()=>[],invalid),{code:'INPUT'});
  }
  await assert.rejects(searchInterpreted(async()=>{throw new AppError('DATABASE','fallo');},interpretation),{code:'DATABASE'});
  assert.deepEqual(await searchInterpreted(async()=>[],interpretation),[]);
});
