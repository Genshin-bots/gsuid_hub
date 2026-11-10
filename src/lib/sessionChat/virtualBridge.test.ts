import { describe, expect, it } from 'vitest';
import {
  VIRTUAL_SESSION_PREFIX,
  chatBlocksToMsgSegs,
  conversationToSessionItem,
  isVirtualSessionId,
  liveChatMessageToChatMsg,
} from './index';
import type { ChatMessage, Conversation, LiveChatIdentity } from '@/lib/liveChat';

const mockIdentity: LiveChatIdentity = {
  userId: '10001',
  nickname: 'Master',
  avatar: 'https://example.com/u.png',
  botSelfId: 'gscore_bot',
};

describe('virtual session bridge', () => {
  it('identifies virtual session IDs by prefix', () => {
    expect(isVirtualSessionId(`${VIRTUAL_SESSION_PREFIX}group:web_group_01`)).toBe(true);
    expect(isVirtualSessionId('onebot:group:12345')).toBe(false);
    expect(isVirtualSessionId('')).toBe(false);
  });

  it('converts Conversation to SessionItem with seconds timestamp and virtual flags', () => {
    const conv: Conversation = {
      id: 'group:web_group_01',
      type: 'group',
      targetId: 'web_group_01',
      name: 'Test Virtual Group',
      updatedAt: 1_700_000_123_000,
      lastPreview: 'Hello Agent',
      messages: [
        {
          id: 'm1',
          role: 'user',
          senderName: 'Master',
          timestamp: 1_700_000_123_000,
          blocks: [{ kind: 'text', text: 'Hello Agent' }],
          rawContent: [{ type: 'text', data: 'Hello Agent' }],
          status: 'sent',
        },
      ],
    };

    const item = conversationToSessionItem(conv, mockIdentity, {
      pinned: true,
      note: 'Custom Note',
    });

    expect(item.session_id).toBe('virtual:group:web_group_01');
    expect(item.virtual).toBe(true);
    expect(item.virtualConvId).toBe('group:web_group_01');
    expect(item.type).toBe('group');
    expect(item.group_id).toBe('web_group_01');
    expect(item.last_time).toBe(1_700_000_123);
    expect(item.pinned).toBe(true);
    expect(item.note).toBe('Custom Note');
  });

  it('converts ChatMessage blocks to MsgSegs and preserves perspective fields', () => {
    const userMsg: ChatMessage = {
      id: 'u1',
      role: 'user',
      senderName: 'Master',
      timestamp: 1_700_000_000_000,
      blocks: [{ kind: 'text', text: 'ping' }],
      rawContent: [{ type: 'text', data: 'ping' }],
      status: 'sent',
    };
    const botMsg: ChatMessage = {
      id: 'b1',
      role: 'bot',
      timestamp: 1_700_000_005_000,
      replyTo: 'u1',
      blocks: [
        { kind: 'reply', msgId: 'u1' },
        { kind: 'markdown', text: '**pong**' },
        {
          kind: 'buttons',
          rows: [
            [
              {
                text: 'Retry',
                data: '/retry',
                style: 1,
                action: 1,
                permisson: 2,
                specify_role_ids: [],
                specify_user_ids: [],
                unsupport_tips: '',
              },
            ],
          ],
        },
      ],
      rawContent: [],
    };

    const all = [userMsg, botMsg];
    const convertedUser = liveChatMessageToChatMsg(userMsg, all, mockIdentity);
    const convertedBot = liveChatMessageToChatMsg(botMsg, all, mockIdentity);

    expect(convertedUser.role).toBe('user');
    expect(convertedUser.self).toBe(true);
    expect(convertedUser.timestamp).toBe(1_700_000_000);

    expect(convertedBot.role).toBe('assistant');
    expect(convertedBot.self).toBe(false);
    expect(convertedBot.segments).toHaveLength(3);
    expect(convertedBot.segments[0]).toEqual({
      type: 'reply',
      id: 'u1',
      text: 'Master: ping',
    });
    expect(convertedBot.segments[1]).toEqual({
      type: 'markdown',
      content: '**pong**',
    });
    expect(convertedBot.segments[2].type).toBe('button');
    expect(chatBlocksToMsgSegs(userMsg.blocks, all, mockIdentity)).toEqual([
      { type: 'text', text: 'ping' },
    ]);
  });

  it('binds persona avatar and name to SessionItem and assistant ChatMsg', () => {
    const conv: Conversation = {
      id: 'direct:早柚',
      type: 'direct',
      targetId: '早柚',
      name: '早柚',
      updatedAt: 1_700_000_200_000,
      messages: [
        {
          id: 'b2',
          role: 'bot',
          timestamp: 1_700_000_200_000,
          blocks: [{ kind: 'text', text: '呼呼…还在困' }],
          rawContent: [],
        },
      ],
    };

    const item = conversationToSessionItem(conv, mockIdentity, {
      personaName: '早柚',
      avatar: '/api/persona/%E6%97%A9%E6%9F%9A/avatar',
    });

    expect(item.session_id).toBe('virtual:direct:早柚');
    expect(item.title).toBe('早柚');
    expect(item.bot_self_id).toBe('早柚');
    expect(item.avatar).toBe('/api/persona/%E6%97%A9%E6%9F%9A/avatar');

    const botMsg = liveChatMessageToChatMsg(conv.messages[0], conv.messages, mockIdentity, {
      name: '早柚',
      avatar: '/api/persona/%E6%97%A9%E6%9F%9A/avatar',
    });

    expect(botMsg.role).toBe('assistant');
    expect(botMsg.self).toBe(false);
    expect(botMsg.user_name).toBe('早柚');
    expect(botMsg.user_avatar).toBe('/api/persona/%E6%97%A9%E6%9F%9A/avatar');
    expect(botMsg.sender.nickname).toBe('早柚');
    expect(botMsg.sender.avatar).toBe('/api/persona/%E6%97%A9%E6%9F%9A/avatar');
  });
});
