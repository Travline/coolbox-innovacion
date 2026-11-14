import assert from 'node:assert/strict';
import test from 'node:test';
import { createChat } from '../dist/chat.js';
import { AppError } from '../dist/errors.js';

const input = { message: 'laptop para estudiar', history: [{ role: 'user', text: 'Busco una computadora' }] };
const product = { id: 'p1', name: 'Laptop Real', brand: 'Marca', description: null, specifications: {}, categories: [{id:'c1',name:'Cómputo'}], sku: {id:'s1',name:null,price:100,listPrice:null,stock:1,images:[],sellerName:null} };
const validOutput = { recommendations: [{ productId: 'p1', evidence: { field: 'brand', value: 'Marca' } }] };
test('recomendaciones se basan en productos recuperados y reciben historial', async () => {
  const chat = createChat(async (query) => { assert.equal(query.text, 'laptop'); return [product]; }, async (received, search) => {
    assert.deepEqual(received, input); await search({text:'laptop'}); return validOutput;
  });
  const result = await chat(input);
  assert.equal(result.status, 'ok'); assert.match(result.text, /Laptop Real — Marca: Marca/); assert.equal(result.recommendations[0].skuId, 's1');
});
test('descarta identificadores y atributos no verificados', async () => {
  const model = async (_input, search) => { await search({text:'laptop'}); return { recommendations: [
    {productId:'inventado',evidence:{field:'name',value:'Inventado'}}, {productId:'p1',evidence:{field:'brand',value:'Falso'}}
  ]}; };
  const result = await createChat(async () => [product], model)(input);
  assert.equal(result.status, 'no_results'); assert.deepEqual(result.recommendations, []); assert.doesNotMatch(result.text, /Falso|Inventado/);
});
test('distingue resultados vacíos y errores de búsqueda o modelo', async () => {
  const empty = await createChat(async () => [], async (_input, search) => {await search({text:'x'}); return {recommendations:[]};})(input);
  assert.equal(empty.status, 'no_results');
  assert.match(empty.text, /tipo de producto o un presupuesto distinto/);
  await assert.rejects(createChat(async () => {throw new AppError('DATABASE','secreto');}, async (_input, search) => { await search({text:'x'}); })(input), {code:'DATABASE'});
  await assert.rejects(createChat(async () => [product], async () => { throw new Error('secreto'); })(input), {code:'MODEL'});
  await assert.rejects(createChat(async () => [product], async () => validOutput)(input), {code:'MODEL'});
});
test('valida entradas y argumentos de herramienta y limita consultas', async () => {
  const chat = createChat(async () => [product], async (_input, search) => { await search({text:'laptop', sql:'delete'}); return validOutput; });
  await assert.rejects(chat({message:'', history:[]}), {code:'INPUT'});
  await assert.rejects(chat(input));
  const service = await chat({message:'¿Cuál es la garantía?',history:[]});
  assert.equal(service.status, 'service_unavailable');
});
test('rechaza salida con estructura inválida', async () => {
  const chat = createChat(async () => [product], async (_input, search) => { await search({text:'laptop'}); return {recommendations:'inventado'}; });
  await assert.rejects(chat(input), {code:'MODEL'});
});

test('pregunta una sola aclaración segura sin buscar ni atribuir preferencias', async () => {
  let calls = 0;
  const chat = createChat(async () => { calls++; return [product]; }, async () => ({ clarification: 'product_type' }));
  const result = await chat({ message: 'Quiero comprar algo', history: [] });
  assert.equal(result.status, 'clarification');
  assert.equal(result.text, '¿Buscas una laptop, un celular u otro producto?');
  assert.deepEqual(result.recommendations, []);
  assert.equal(calls, 0);
  assert.equal((result.text.match(/\?/g) || []).length, 1);
});

test('usa la respuesta a la aclaración junto al historial y no inventa filtros', async () => {
  const history = [
    { role: 'user', text: 'Quiero una laptop' },
    { role: 'assistant', text: '¿Lo necesitas para estudiar, trabajar o para otro uso?' }
  ];
  const chat = createChat(async (query) => {
    assert.deepEqual(query, { text: 'laptop para estudiar', maxPrice: 2000 });
    return [product];
  }, async (received, search) => {
    assert.deepEqual(received.history, history);
    assert.equal(received.message, 'Para estudiar, hasta 2000');
    await search({ text: 'laptop para estudiar', maxPrice: 2000 });
    return validOutput;
  });
  assert.equal((await chat({ message: 'Para estudiar, hasta 2000', history })).status, 'ok');
});

test('no repite pregunta tras no saber, busca sin filtro supuesto y no recomienda candidatos no evaluados', async () => {
  for (const message of ['no sé', 'no tengo preferencia', 'me da igual']) {
    const history = [
      { role: 'user', text: 'Quiero una laptop' },
      { role: 'assistant', text: '¿Qué presupuesto aproximado tienes? Si no tienes uno, puedes decirlo.' }
    ];
    const chat = createChat(async (query) => {
      assert.deepEqual(query, { text: 'Quiero una laptop' });
      return [product];
    }, async () => ({ clarification: 'budget' }));
    const result = await chat({ message, history });
    assert.equal(result.status, 'no_results');
    assert.deepEqual(result.recommendations, []);
    assert.doesNotMatch(result.text, /Laptop Real/);
  }
});

test('una pregunta repetida no convierte un candidato irrelevante en recomendación', async () => {
  const irrelevant = { ...product, name: 'Accesorio irrelevante' };
  const history = [{ role: 'assistant', text: '¿Buscas una laptop, un celular u otro producto?' }];
  let calls = 0;
  const chat = createChat(async (query) => {
    calls++;
    assert.deepEqual(query, { text: 'Necesito algo para estudiar' });
    return [irrelevant];
  }, async () => ({ clarification: 'product_type' }));
  const result = await chat({ message: 'Necesito algo para estudiar', history });
  assert.equal(calls, 1);
  assert.equal(result.status, 'no_results');
  assert.deepEqual(result.recommendations, []);
  assert.doesNotMatch(result.text, /Accesorio irrelevante/);
});

test('un fallo al continuar la búsqueda sigue siendo error y no ausencia de resultados', async () => {
  const history = [
    { role: 'user', text: 'Quiero una laptop' },
    { role: 'assistant', text: '¿Qué presupuesto aproximado tienes? Si no tienes uno, puedes decirlo.' }
  ];
  const chat = createChat(async () => { throw new AppError('DATABASE', 'error controlado'); }, async () => ({ clarification: 'budget' }));
  await assert.rejects(chat({ message: 'no sé', history }), { code: 'DATABASE' });
});

test('respuestas específicas, correcciones y cambio de tema llegan al modelo sin fijar preferencias', async () => {
  const examples = [
    { message: 'Laptop Acer para estudiar por 2000', history: [], query: { text: 'laptop para estudiar', brand: 'Acer', maxPrice: 2000 } },
    { message: 'Corrijo: máximo 1500', history: [{ role: 'user', text: 'Laptop hasta 2000' }], query: { text: 'laptop', maxPrice: 1500 } },
    { message: 'Ahora necesito audífonos', history: [{ role: 'user', text: 'Laptop Acer por 2000' }], query: { text: 'audífonos' } }
  ];
  for (const example of examples) {
    const chat = createChat(async (query) => { assert.deepEqual(query, example.query); return [product]; }, async (received, search) => {
      assert.equal(received.message, example.message);
      assert.deepEqual(received.history, example.history);
      await search(example.query);
      return validOutput;
    });
    assert.equal((await chat({ message: example.message, history: example.history })).status, 'ok');
  }
});

test('descarta aclaraciones libres o con campos adicionales', async () => {
  for (const raw of [
    { clarification: '¿Quieres el producto que tenemos en stock?' },
    { clarification: 'use', text: 'Inventado' },
    { clarification: 'use', recommendations: [] }
  ]) {
    const chat = createChat(async () => [product], async () => raw);
    await assert.rejects(chat(input), { code: 'MODEL' });
  }
});

test('elimina filtros que no provienen del visitante o usan un presupuesto corregido', async () => {
  const history = [
    { role: 'user', text: 'Quiero una laptop hasta 3000' },
    { role: 'assistant', text: '¿Lo necesitas para estudiar, trabajar o para otro uso?' }
  ];
  const chat = createChat(async (query) => {
    assert.deepEqual(query, { text: 'laptop' });
    return [product];
  }, async (_input, search) => {
    await search({ text: 'laptop', brand: 'Sony', maxPrice: 3000, categoryId: '888', inStock: true });
    return validOutput;
  });
  assert.equal((await chat({ message: 'Corrijo: máximo 1500', history })).status, 'ok');
});

test('si el visitante indica que no tiene presupuesto no reutiliza uno anterior', async () => {
  const history = [
    { role: 'user', text: 'Quiero una laptop hasta 3000' },
    { role: 'assistant', text: '¿Qué presupuesto aproximado tienes? Si no tienes uno, puedes decirlo.' }
  ];
  const chat = createChat(async (query) => {
    assert.deepEqual(query, { text: 'laptop' });
    return [product];
  }, async (_input, search) => {
    await search({ text: 'laptop', maxPrice: 3000 });
    return validOutput;
  });
  assert.equal((await chat({ message: 'no tengo presupuesto', history })).status, 'ok');
});

test('emite cada selección solo después de comprobar atributos, antes de terminar el modelo', async () => {
  const second = {...product,id:'p2',name:'Laptop Segunda'};
  const seen = [];
  const chat = createChat(async () => [product, second], async (_input, search, propose) => {
    await search({text:'laptop'});
    assert.equal(propose({productId:'p1',evidence:{field:'brand',value:'Falso'}}),false);
    assert.equal(propose({productId:'p1',evidence:{field:'brand',value:'Marca'}}),true);
    assert.equal(seen.length,1);
    await Promise.resolve();
    assert.equal(propose({productId:'p2',evidence:{field:'name',value:'Laptop Segunda'}}),true);
    assert.equal(seen.length,2);
    return {recommendations:[]};
  });
  const result=await chat(input,item=>seen.push(item));
  assert.equal(result.status,'ok');
  assert.deepEqual(seen.map(item=>item.name),['Laptop Real','Laptop Segunda']);
  assert.equal(result.recommendations.length,2);
});

test('si falla el modelo después de una selección, el consumidor conserva el fragmento y recibe error', async () => {
  const seen=[];
  const chat=createChat(async()=>[product],async(_input,search,propose)=>{
    await search({text:'laptop'});
    propose({productId:'p1',evidence:{field:'brand',value:'Marca'}});
    throw new Error('fallo controlado');
  });
  await assert.rejects(chat(input,item=>seen.push(item)),{code:'MODEL'});
  assert.equal(seen.length,1);
});
