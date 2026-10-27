import { describe, expect, it } from 'vitest';
import {
  coerceConfigValueForSave,
  convertPluginConfigValueForSave,
  embeddingConfigPayload,
} from './configSaveValue';

describe('embedding config payload', () => {
  it('turns dropdown strings back into ints when the field type is gsint', () => {
    expect(
      embeddingConfigPayload({
        embedding_model_name: { type: 'gsstr', data: 'jinaai/jina-embeddings-v2-base-zh' },
        embedding_modalities: { type: 'gsliststr', data: ['text'] },
        embed_batch_workers: { type: 'gsint', data: '2' },
        embed_threads: { type: 'gsint', data: '2' },
        embed_batch_size: { type: 'gsint', data: '64' },
      }),
    ).toEqual({
      embedding_model_name: 'jinaai/jina-embeddings-v2-base-zh',
      embedding_modalities: ['text'],
      embed_batch_workers: 2,
      embed_threads: 2,
      embed_batch_size: 64,
    });
  });

  it('keeps an untouched number and coerces openai dimension', () => {
    expect(coerceConfigValueForSave('gsint', 16)).toBe(16);
    expect(coerceConfigValueForSave('gsint', '768')).toBe(768);
    expect(coerceConfigValueForSave('gsfloat', '1.5')).toBe(1.5);
    expect(coerceConfigValueForSave('gsstr', '2')).toBe('2');
  });

  it('does not guess a number when the backend omitted type', () => {
    expect(embeddingConfigPayload({ embed_batch_workers: { data: '2' } })).toEqual({
      embed_batch_workers: '2',
    });
    expect(Number.isNaN(coerceConfigValueForSave('gsint', ''))).toBe(true);
  });
});

describe('plugin config save', () => {
  it('converts an optioned integer select without converting strings', () => {
    expect(
      convertPluginConfigValueForSave({ type: 'select', rawType: 'gsint', value: '8' }),
    ).toEqual({ skip: false, value: 8 });
    expect(
      convertPluginConfigValueForSave({ type: 'select', rawType: 'gsstr', value: '8' }),
    ).toEqual({ skip: false, value: '8' });
    expect(convertPluginConfigValueForSave({ type: 'number', rawType: 'gsint', value: 3 })).toEqual(
      { skip: false, value: 3 },
    );
    expect(
      convertPluginConfigValueForSave({ type: 'number', rawType: 'gsfloat', value: '1.25' }),
    ).toEqual({ skip: false, value: 1.25 });
  });

  it('keeps divider skip, dict parse, and int list conversion', () => {
    expect(convertPluginConfigValueForSave({ type: 'divider', rawType: 'gsdivider' })).toEqual({
      skip: true,
    });
    expect(convertPluginConfigValueForSave({ type: 'button', rawType: 'gsbutton' })).toEqual({
      skip: true,
    });
    expect(
      convertPluginConfigValueForSave({ type: 'text', rawType: 'gsdict', value: '{"a":1}' }),
    ).toEqual({ skip: false, value: { a: 1 } });
    expect(
      convertPluginConfigValueForSave({ type: 'text', rawType: 'gsdict', value: 'not-json' }),
    ).toEqual({ skip: false, value: 'not-json' });
    expect(
      convertPluginConfigValueForSave({
        type: 'tags',
        rawType: 'gslist',
        value: ['1', '2', 'x'],
      }),
    ).toEqual({ skip: false, value: [1, 2] });
  });
});
