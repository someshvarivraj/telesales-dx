import pino from 'pino';
import { describe, expect, it } from 'vitest';
import type { AssistantConfig } from '../src/config/AppConfig.js';
import type { Actor } from '../src/domain/access/AccessPolicy.js';
import { AssistantService } from '../src/modules/assistant/AssistantService.js';
import type { AssistantTools } from '../src/modules/assistant/AssistantTools.js';

const config: AssistantConfig = {
  baseUrl: 'https://example.invalid/v1',
  apiKey: 'test-key',
  model: 'test-model',
  reasoningEffort: undefined,
  timeoutMs: 5000,
};
const actor = { id: 'u1', can: () => true, hasRole: () => false } as Actor;
const user = { name: '試験 花子', roleLabel: 'テレマ' };
const clock = { now: () => new Date('2026-10-28T01:00:00Z') };
const silent = pino({ level: 'silent' });

/** A fake model: returns the queued replies in order and records each request body. */
function fakeModel(replies: object[]) {
  const bodies: { messages: { role: string; content?: string }[]; tools?: unknown }[] = [];
  const fetchImpl = (async (_url: string, init: { body: string }) => {
    bodies.push(JSON.parse(init.body));
    return new Response(JSON.stringify(replies.shift()), { status: 200 });
  }) as unknown as typeof fetch;
  return { fetchImpl, bodies };
}

const answer = (content: string) => ({ choices: [{ message: { content } }] });

describe('MoraBot assistant', () => {
  it('is off without a key', () => {
    const service = new AssistantService(
      { ...config, apiKey: '' },
      {} as AssistantTools,
      clock,
      silent,
    );
    expect(service.enabled).toBe(false);
  });

  it('answers a how-to question with the manual in the system prompt', async () => {
    const model = fakeModel([answer('1. 「架電状況」を開きます。')]);
    const service = new AssistantService(
      config,
      {} as AssistantTools,
      clock,
      silent,
      model.fetchImpl,
    );
    const result = await service.chat(actor, user, [
      { role: 'user', content: 'リストの取り込み方は？' },
    ]);
    expect(result.reply).toBe('1. 「架電状況」を開きます。');
    const system = model.bodies[0]?.messages[0];
    expect(system?.role).toBe('system');
    expect(system?.content).toContain('2026-10-28');
    expect(system?.content).toContain('試験 花子さん（テレマ）');
    expect(system?.content).toContain('/calls/import');
    // Screen-by-screen: buttons such as 「あとで送る」 on the mail screen are explained.
    expect(system?.content).toContain('「あとで送る」：送らずにアポのページへ戻る');
    expect(system?.content).toContain('/calls/companies/{ID}');
    expect(system?.content).toContain('質問と同じ言葉で答える');
  });

  it('runs a tool as the signed-in user and answers from its result', async () => {
    const model = fakeModel([
      {
        choices: [
          {
            message: {
              content: null,
              tool_calls: [
                { id: 'c1', type: 'function', function: { name: 'get_my_todos', arguments: '{}' } },
              ],
            },
          },
        ],
      },
      answer('今日やることは2件です。'),
    ]);
    const calls: unknown[] = [];
    const tools = {
      run: async (who: Actor, name: string, args: unknown) => {
        calls.push([who.id, name, args]);
        return { todayPlans: 2, link: '/home' };
      },
    } as unknown as AssistantTools;
    const service = new AssistantService(config, tools, clock, silent, model.fetchImpl);
    const result = await service.chat(actor, user, [{ role: 'user', content: '今日やることは？' }]);
    expect(calls).toEqual([['u1', 'get_my_todos', {}]]);
    expect(result.reply).toBe('今日やることは2件です。');
    const second = model.bodies[1]?.messages ?? [];
    expect(second.at(-1)).toEqual({
      role: 'tool',
      tool_call_id: 'c1',
      content: '{"todayPlans":2,"link":"/home"}',
    });
  });

  it('stops offering tools after the last round', async () => {
    const loop = {
      choices: [
        {
          message: {
            content: null,
            tool_calls: [
              { id: 'x', type: 'function', function: { name: 'get_my_todos', arguments: '{}' } },
            ],
          },
        },
      ],
    };
    const model = fakeModel([loop, loop, loop, loop, loop, loop, answer('まとめです。')]);
    const tools = { run: async () => ({}) } as unknown as AssistantTools;
    const service = new AssistantService(config, tools, clock, silent, model.fetchImpl);
    const result = await service.chat(actor, user, [{ role: 'user', content: '調べて' }]);
    expect(result.reply).toBe('まとめです。');
    expect(model.bodies.at(-1)?.tools).toBeUndefined();
  });

  it('reports the model being unavailable without leaking the response', async () => {
    const fetchImpl = (async () =>
      new Response('secret echo', { status: 500 })) as unknown as typeof fetch;
    const service = new AssistantService(config, {} as AssistantTools, clock, silent, fetchImpl);
    await expect(
      service.chat(actor, user, [{ role: 'user', content: 'こんにちは' }]),
    ).rejects.toMatchObject({
      details: { reason: 'assistant_unavailable' },
    });
  });
});

describe('MoraBot working with the person', () => {
  const toolCall = (name: string, args: object) => ({
    choices: [
      {
        message: {
          content: null,
          tool_calls: [
            { id: 'c1', type: 'function', function: { name, arguments: JSON.stringify(args) } },
          ],
        },
      },
    ],
  });

  it('asks with choices and waits for the answer', async () => {
    const model = fakeModel([
      toolCall('ask_user', {
        question: 'どちらの会社ですか？',
        options: [
          { label: '試験工業（大阪）' },
          { label: '試験工業（東京）', description: '本社' },
        ],
      }),
    ]);
    const service = new AssistantService(
      config,
      {} as AssistantTools,
      clock,
      silent,
      model.fetchImpl,
    );
    const result = await service.chat(actor, user, [{ role: 'user', content: 'アポを取って' }]);
    expect(model.bodies).toHaveLength(1);
    expect(result.reply).toBe('どちらの会社ですか？');
    expect(result.question).toEqual({
      question: 'どちらの会社ですか？',
      options: [{ label: '試験工業（大阪）' }, { label: '試験工業（東京）', description: '本社' }],
    });
  });

  it('opens in-app screens only', async () => {
    const model = fakeModel([
      toolCall('open_screen', { path: 'https://evil.example/x' }),
      toolCall('open_screen', { path: '/schedule?date=2026-11-04' }),
      answer('予定表を開きました。'),
    ]);
    const steps: string[] = [];
    const service = new AssistantService(
      config,
      {} as AssistantTools,
      clock,
      silent,
      model.fetchImpl,
    );
    const result = await service.chat(actor, user, [{ role: 'user', content: '予定表を見せて' }], {
      onStep: (step) => steps.push(`${step.ok ? 'ok' : 'ng'}:${step.text}`),
    });
    expect(result.openPath).toBe('/schedule?date=2026-11-04');
    expect(steps).toEqual([
      'ng:画面を開く（https://evil.example/x） → できませんでした',
      'ok:画面を開く（/schedule?date=2026-11-04）',
    ]);
  });

  it('tells the model which screen the person is on', async () => {
    const model = fakeModel([answer('はい。')]);
    const service = new AssistantService(
      config,
      {} as AssistantTools,
      clock,
      silent,
      model.fetchImpl,
    );
    await service.chat(actor, user, [{ role: 'user', content: 'この会社は？' }], {
      screen: '企業のページ（試験工業）',
    });
    expect(model.bodies[0]?.messages[0]?.content).toContain(
      '開いている画面：企業のページ（試験工業）',
    );
  });
});
