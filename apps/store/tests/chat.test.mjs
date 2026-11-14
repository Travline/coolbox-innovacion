import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

const source = await readFile(new URL('../src/chat.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const sse = (...events) => new Response(events.map(event => `data: ${JSON.stringify(event)}\n\n`).join(''), {status:200,headers:{'Content-Type':'text/event-stream'}});
const { requestChatResponse, initialChatSession, beginChatTurn, retryChatTurn, finishChatTurn } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);

test('pasa consulta e historial al proveedor y devuelve la respuesta', async () => {
  const history = [{ role: 'user', text: 'Necesito una laptop' }];
  const result = await requestChatResponse('Para estudiar', history, async (text, received) => {
    assert.equal(text, 'Para estudiar');
    assert.deepEqual(received, history);
    return 'Respuesta provisional';
  });
  assert.deepEqual(result, { ok: true, text: 'Respuesta provisional' });
});

test('un fallo del proveedor se distingue de una respuesta y no revela detalles', async () => {
  const result = await requestChatResponse('Consulta', [], async () => { throw new Error('detalle interno'); });
  assert.deepEqual(result, { ok: false });
});

const { createChatProvider } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);
test('envía mensaje e historial a la API y muestra texto verificado', async () => {
  const history = [{ role: 'user', text: 'Necesito una laptop' }];
  const provider = createChatProvider('https://api.example.test', async (url, options) => {
    assert.equal(String(url), 'https://api.example.test/api/chat');
    assert.equal(options.method, 'POST');
    assert.deepEqual(JSON.parse(options.body), { message: 'Para estudiar', history });
    return sse({type:'activity'},{type:'recommendation',text:'Laptop Real — Marca: Real',recommendation:{productId:'p1',skuId:'s1',name:'Laptop Real',reason:'Marca: Real'}},{type:'done'});
  });
  assert.deepEqual(await requestChatResponse('Para estudiar', history, provider), {ok:true,text:'Laptop Real — Marca: Real'});
});

test('muestra ausencia de resultados y conserva solo el contexto reciente', async () => {
  const history = Array.from({length:25}, (_, i) => ({role:'user',text:`mensaje ${i}`}));
  const provider = createChatProvider('http://localhost:3001', async (_url, options) => {
    assert.equal(JSON.parse(options.body).history.length, 20);
    assert.equal(JSON.parse(options.body).history[0].text, 'mensaje 5');
    return sse({type:'no_results',text:'Sin resultados'},{type:'done'});
  });
  assert.equal(await provider('consulta', history), 'Sin resultados');
});

test('muestra la aclaración y envía su contexto en la siguiente consulta', async () => {
  const history = [
    {role:'user', text:'Quiero una laptop'},
    {role:'assistant', text:'¿Lo necesitas para estudiar, trabajar o para otro uso?'}
  ];
  const provider = createChatProvider('http://localhost:3001', async (_url, options) => {
    const body = JSON.parse(options.body);
    assert.deepEqual(body, {message:'Para estudiar',history});
    return sse({type:'message',text:'¿Qué presupuesto aproximado tienes? Si no tienes uno, puedes decirlo.'},{type:'done'});
  });
  const result = await provider('Para estudiar', history);
  assert.match(result, /presupuesto/);
});

test('HTTP, red y respuestas inválidas producen error sin exponer detalles', async () => {
  for (const fetcher of [
    async () => new Response('error secreto',{status:503}),
    async () => { throw new Error('token secreto'); },
    async () => sse({type:'recommendation',text:'producto inventado',recommendation:{name:'sin identificador'}},{type:'done'}),
    async () => new Response('no es JSON',{status:200})
  ]) {
    const result = await requestChatResponse('consulta', [], createChatProvider('https://api.example.test', fetcher));
    assert.deepEqual(result,{ok:false});
  }
});

test('reintenta la consulta con su contexto original sin duplicar el mensaje, incluso tras varios fallos', async () => {
  const initial = { ...initialChatSession, messages: [{ role: 'user', text: 'Busco una laptop' }, { role: 'assistant', text: '¿Para qué uso?' }] };
  const inFlight = beginChatTurn(initial, '  Para estudiar  ');
  assert.deepEqual(inFlight.attempt, { text: 'Para estudiar', history: initial.messages });
  assert.equal(inFlight.messages.length, 3);
  assert.strictEqual(beginChatTurn(inFlight, 'Otro'), inFlight);
  assert.strictEqual(retryChatTurn(inFlight), inFlight);
  let state = finishChatTurn(inFlight, { ok: false });
  assert.equal(state.state, 'error');
  for (let i = 0; i < 2; i++) {
    state = retryChatTurn(state);
    assert.deepEqual(state.attempt, { text: 'Para estudiar', history: initial.messages });
    assert.equal(state.messages.length, 3);
    state = finishChatTurn(state, { ok: false });
  }
  state = retryChatTurn(state);
  state = finishChatTurn(state, { ok: true, text: 'No encontré productos. Prueba con otro criterio.' });
  assert.equal(state.state, 'idle');
  assert.equal(state.messages.length, 4);
  assert.equal(state.messages.filter((message) => message.text === 'Para estudiar').length, 1);
  assert.equal(state.attempt, null);
});

test('un error de conexión permite continuar y la preparación para incompletas conserva el intento', () => {
  const attempted = beginChatTurn(initialChatSession, 'Audífonos');
  const failed = finishChatTurn(attempted, { ok: false });
  const next = beginChatTurn(failed, 'Altavoces');
  assert.equal(next.messages.length, 2);
  assert.equal(next.attempt.text, 'Altavoces');
  assert.deepEqual(next.attempt.history, [{ role: 'user', text: 'Audífonos' }]);
  const incomplete = { ...attempted, state: 'incomplete' };
  const retry = retryChatTurn(incomplete);
  assert.equal(retry.state, 'pending');
  assert.deepEqual(retry.attempt, attempted.attempt);
  assert.deepEqual(retry.messages, attempted.messages);
});


test('recibe recomendaciones sucesivas y detecta una transmisión truncada', async () => {
  const encoder = new TextEncoder(), received = [];
  const item = {productId:'p',skuId:'s',name:'A',reason:'Marca: B'};
  const chunks = [{type:'activity'}, {type:'recommendation',text:'A — Marca: B',recommendation:item}, {type:'recommendation',text:'C — Marca: D',recommendation:{...item,productId:'p2',name:'C',reason:'Marca: D'}}, {type:'done'}];
  const fetcher = async () => new Response(new ReadableStream({ start(controller) {
    for (const chunk of chunks) controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`)); controller.close();
  }}), {headers:{'Content-Type':'text/event-stream'}});
  const result = await createChatProvider('http://localhost', fetcher)('consulta', [], value => received.push(value));
  assert.deepEqual(received, ['A — Marca: B', 'C — Marca: D']);
  assert.equal(result, received.join('\n'));
  let session = beginChatTurn(initialChatSession, 'consulta');
  const { appendChatFragment } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);
  const truncated = createChatProvider('http://localhost', async () => sse(chunks[1]));
  const failed = await requestChatResponse('consulta', [], truncated, fragment => { session = appendChatFragment(session, fragment); });
  session = finishChatTurn(session, failed);
  assert.equal(session.state, 'incomplete');
  assert.equal(session.partial, 'A — Marca: B');
  session = retryChatTurn(session);
  assert.equal(session.partial, '');
  assert.equal(session.messages.length, 1);
});
