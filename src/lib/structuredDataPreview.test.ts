import { describe, expect, it } from 'vitest';
import {
  extractBase64Payload,
  isStructuredDataPreviewOpen,
  parseBase64ImageMeta,
  retainStructuredDataPreview,
  tryParseStructuredData,
} from './structuredDataPreview';

describe('structuredDataPreview', () => {
  it('tracks preview open state with reference counting', () => {
    expect(isStructuredDataPreviewOpen()).toBe(false);
    const release1 = retainStructuredDataPreview();
    const release2 = retainStructuredDataPreview();
    expect(isStructuredDataPreviewOpen()).toBe(true);
    release1();
    expect(isStructuredDataPreviewOpen()).toBe(true);
    // 幂等释放不应当多减
    release1();
    expect(isStructuredDataPreviewOpen()).toBe(true);
    release2();
    expect(isStructuredDataPreviewOpen()).toBe(false);
  });

  it('extracts pure base64 payload without protocol/data-url prefix', () => {
    const sample =
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9aw==';
    expect(extractBase64Payload(`base64://${sample}`)).toBe(sample);
    expect(extractBase64Payload(`data:image/png;base64,${sample}`)).toBe(sample);
    expect(extractBase64Payload(sample)).toBe(sample);
  });

  it('parses base64 image metadata accurately', () => {
    const pngRaw =
      'base64://iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9aw==';
    const meta = parseBase64ImageMeta(pngRaw);
    expect(meta.mime).toBe('image/png');
    expect(meta.format).toBe('PNG');
    expect(meta.isDataUrl).toBe(false);
  });

  it('preserves structured parsing for compact Python/JSON logs containing base64 payloads', () => {
    const b64 =
      'base64://iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9aw==';
    const compactLog = `Message(type='image', data='${b64}')`;

    const parsed = tryParseStructuredData(compactLog) as Record<string, unknown> | null;
    expect(parsed).not.toBeNull();
    expect(parsed?.__class__).toBe('Message');
    const args = parsed?.args as Record<string, unknown>;
    expect(args.type).toBe('image');
    expect(args.data).toBe(b64);
  });

  it('falls back to null (plain text + inline badge) when SimpleRenderer would truncate fields or depth', () => {
    const b64 =
      'base64://iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9aw==';
    const fullMessageReceiveLog = `MessageReceive(bot_id='onebot', bot_self_id='d', msg_id='1', user_type='group', group_id='123', user_id='456', content=[Message(type='image', data='${b64}')])`;

    // 超过 3 个参数 / 深度超过 3 层时返回 null，交由 TextWithBase64 完整渲染原文与图片徽标
    expect(tryParseStructuredData(fullMessageReceiveLog)).toBeNull();
  });
});
