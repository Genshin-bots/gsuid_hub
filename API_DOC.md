# GsCore WebConsole API 文档

本文档提供 GsCore WebConsole 所有后端接口的详细说明。所有接口都需要认证。

## 目录

- [GsCore WebConsole API 文档](#gscore-webconsole-api-文档)
  - [目录](#目录)
  - [认证](#认证)
  - [插件管理 APIs](#插件管理-apis)
    - [获取插件列表](#获取插件列表)
    - [获取插件详情](#获取插件详情)
    - [更新插件配置](#更新插件配置)
    - [更新单个插件配置项](#更新单个插件配置项)
    - [更新插件服务配置](#更新插件服务配置)
    - [更新插件服务单个字段](#更新插件服务单个字段)
    - [更新服务配置](#更新服务配置)
    - [更新单个服务字段](#更新单个服务字段)
    - [切换插件状态](#切换插件状态)
  - [框架配置 APIs](#框架配置-apis)
    - [获取框架配置列表](#获取框架配置列表)
    - [获取框架配置详情](#获取框架配置详情)
    - [更新框架配置](#更新框架配置)
    - [更新单个框架配置项](#更新单个框架配置项)
  - [插件商店 APIs](#插件商店-apis)
    - [获取插件商店列表](#获取插件商店列表)
    - [安装插件](#安装插件)
    - [更新插件](#更新插件)
    - [卸载插件](#卸载插件)
  - [角色配置 APIs](#角色配置-apis)
    - [获取角色配置](#获取角色配置)
    - [更新角色配置](#更新角色配置)
    - [获取全局启用的角色](#获取全局启用的角色)
    - [获取所有角色配置](#获取所有角色配置)
  - [通用响应格式](#通用响应格式)
    - [成功响应](#成功响应)
    - [错误响应](#错误响应)
  - [状态码说明](#状态码说明)
  - [配置类型说明](#配置类型说明)

---

## 认证

所有 API 需要在请求头中携带认证信息：

```
Authorization: Bearer <token>
```

---

## 插件管理 APIs

### 获取插件列表

获取所有已加载插件的列表，包含 ICON 头像（轻量级接口）。

**请求**

```
GET /api/plugins/list
```

**响应**

```json
{
  "status": 0,
  "msg": "ok",
  "data": [
    {
      "id": "gsuid_core",
      "name": "GsUid_core",
      "description": "已加载插件：GsUid_core",
      "enabled": true,
      "status": "running",
      "icon": "data:image/png;base64,..."
    }
  ]
}
```

**响应字段说明**

| 字段 | 类型 | 说明 |
|------|------|------|
| id | string | 插件 ID（小写） |
| name | string | 插件名称 |
| description | string | 插件描述 |
| enabled | boolean | 是否启用 |
| status | string | 运行状态 |
| icon | string | Base64 编码的插件图标 |

---

### 获取插件详情

获取单个插件的完整信息（包含配置、服务等）。

**请求**

```
GET /api/plugins/{plugin_name}
```

**参数**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| plugin_name | string | 是 | 插件名称（不区分大小写） |

**响应**

```json
{
  "status": 0,
  "msg": "ok",
  "data": {
    "id": "gsuid_core",
    "name": "GsUid_core",
    "description": "已加载插件：GsUid_core",
    "enabled": true,
    "status": "running",
    "config": {
      "admin_list": {
        "value": [],
        "default": [],
        "type": "str",
        "title": "管理员列表",
        "desc": "管理员 QQ 号列表"
      }
    },
    "config_groups": [
      {
        "config_name": "GsCoreGsUid",
        "config": {
          "admin_list": {
            "value": [],
            "default": [],
            "type": "str",
            "title": "管理员列表",
            "desc": "管理员 QQ 号列表"
          }
        }
      }
    ],
    "config_names": ["GsCoreGsUid"],
    "service_config": {
      "enabled": true,
      "pm": 1,
      "priority": 1000,
      "area": [],
      "black_list": [],
      "white_list": [],
      "prefix": "",
      "force_prefix": false,
      "disable_force_prefix": false,
      "allow_empty_prefix": false
    },
    "sv_list": [
      {
        "name": "gs",
        "enabled": true,
        "pm": 1,
        "priority": 1000,
        "area": [],
        "black_list": [],
        "white_list": []
      }
    ],
    "icon": "data:image/png;base64,..."
  }
}
```

**响应字段说明**

| 字段 | 类型 | 说明 |
|------|------|------|
| id | string | 插件 ID |
| name | string | 插件名称 |
| config | object | 平铺的配置对象（兼容旧前端） |
| config_groups | array | 配置组列表 |
| config_names | array | 配置名称列表 |
| service_config | object | 插件服务配置 |
| sv_list | array | 服务列表 |
| icon | string | Base64 编码的插件图标 |

---

### 更新插件配置

更新插件配置（支持多种配置对象）。

**请求**

```
POST /api/plugins/{plugin_name}
```

**参数**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| plugin_name | string | 是 | 插件名称 |

**请求体**

```json
{
  "config_groups": [
    {
      "config_name": "GsCoreGsUid",
      "config": {
        "admin_list": ["123456"]
      }
    }
  ]
}
```

或平铺格式（旧兼容）：

```json
{
  "admin_list": ["123456"]
}
```

**响应**

```json
{
  "status": 0,
  "msg": "配置已保存"
}
```

---

### 更新单个插件配置项

更新单个插件的单个配置项（单个请求模式）。

**请求**

```
POST /api/plugins/{plugin_name}/config/{config_name}/{item_name}
```

**参数**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| plugin_name | string | 是 | 插件名称 |
| config_name | string | 是 | 配置名称 |
| item_name | string | 是 | 配置项名称 |

**请求体**

```json
{
  "value": "新的配置值"
}
```

**响应**

```json
{
  "status": 0,
  "msg": "配置项已保存"
}
```

---

### 更新插件服务配置

更新插件服务配置。

**请求**

```
POST /api/plugins/{plugin_name}/service
```

**参数**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| plugin_name | string | 是 | 插件名称 |

**请求体**

```json
{
  "pm": 1,
  "priority": 1000,
  "area": [],
  "black_list": [],
  "white_list": [],
  "prefix": "!",
  "force_prefix": false,
  "disable_force_prefix": false,
  "allow_empty_prefix": false,
  "enabled": true
}
```

**响应**

```json
{
  "status": 0,
  "msg": "服务配置已保存"
}
```

---

### 更新插件服务单个字段

更新插件服务配置的单个字段（单个请求模式）。

**请求**

```
POST /api/plugins/{plugin_name}/service/{field_name}
```

**参数**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| plugin_name | string | 是 | 插件名称 |
| field_name | string | 是 | 字段名称 |

**可用字段**

| 字段 | 类型 | 说明 |
|------|------|------|
| pm | integer | 权限等级 |
| priority | integer | 优先级 |
| area | array | 生效区域 |
| black_list | array | 黑名单 |
| white_list | array | 白名单 |
| prefix | string | 命令前缀 |
| force_prefix | boolean | 强制使用前缀 |
| disable_force_prefix | boolean | 禁用强制前缀 |
| allow_empty_prefix | boolean | 允许空前缀 |
| enabled | boolean | 是否启用 |

**请求体**

```json
{
  "value": "新的值"
}
```

**响应**

```json
{
  "status": 0,
  "msg": "服务配置已保存"
}
```

---

### 更新服务配置

更新单个服务的配置。

**请求**

```
POST /api/plugins/{plugin_name}/sv/{sv_name}
```

**参数**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| plugin_name | string | 是 | 插件名称 |
| sv_name | string | 是 | 服务名称 |

**请求体**

```json
{
  "pm": 1,
  "priority": 1000,
  "area": [],
  "black_list": [],
  "white_list": [],
  "enabled": true
}
```

**响应**

```json
{
  "status": 0,
  "msg": "服务配置已保存"
}
```

---

### 更新单个服务字段

更新单个服务的单个字段（单个请求模式）。

**请求**

```
POST /api/plugins/{plugin_name}/sv/{sv_name}/{field_name}
```

**参数**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| plugin_name | string | 是 | 插件名称 |
| sv_name | string | 是 | 服务名称 |
| field_name | string | 是 | 字段名称 |

**可用字段**

| 字段 | 类型 | 说明 |
|------|------|------|
| pm | integer | 权限等级 |
| priority | integer | 优先级 |
| area | array | 生效区域 |
| black_list | array | 黑名单 |
| white_list | array | 白名单 |
| enabled | boolean | 是否启用 |

**请求体**

```json
{
  "value": "新的值"
}
```

**响应**

```json
{
  "status": 0,
  "msg": "服务配置已保存"
}
```

---

### 切换插件状态

启用或禁用插件。

**请求**

```
POST /api/plugins/{plugin_name}/toggle?enabled=true
```

**参数**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| plugin_name | string | 是 | 插件名称 |
| enabled | boolean | 是 | 是否启用 |

**响应**

```json
{
  "status": 0,
  "msg": "插件已启用"
}
```

---

## 框架配置 APIs

### 获取框架配置列表

获取所有框架配置的列表（轻量级接口）。

**请求**

```
GET /api/framework-config/list?prefix=GsCore
```

**参数**

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| prefix | string | 否 | GsCore | 配置名称前缀筛选 |

**响应**

```json
{
  "status": 0,
  "msg": "ok",
  "data": [
    {
      "id": "GsCoreGsUid",
      "name": "GsUid",
      "full_name": "GsCoreGsUid"
    },
    {
      "id": "GsCoreLog",
      "name": "Log",
      "full_name": "GsCoreLog"
    }
  ]
}
```

**响应字段说明**

| 字段 | 类型 | 说明 |
|------|------|------|
| id | string | 配置 ID（完整名称） |
| name | string | 显示名称（去掉前缀） |
| full_name | string | 完整配置名称 |

---

### 获取框架配置详情

获取单个框架配置的完整信息。

**请求**

```
GET /api/framework-config/{config_name}
```

**参数**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| config_name | string | 是 | 配置名称（支持带或不带 GsCore 前缀） |

**响应**

```json
{
  "status": 0,
  "msg": "ok",
  "data": {
    "id": "GsCoreGsUid",
    "name": "GsUid",
    "full_name": "GsCoreGsUid",
    "config": {
      "admin_list": {
        "value": [],
        "default": [],
        "type": "str",
        "title": "管理员列表",
        "desc": "管理员 QQ 号列表",
        "options": null
      }
    }
  }
}
```

**config 字段说明**

每个配置项包含以下字段：

| 字段 | 类型 | 说明 |
|------|------|------|
| value | any | 当前值 |
| default | any | 默认值 |
| type | string | 配置类型（如 str, int, bool, gsimage 等） |
| title | string | 配置标题 |
| desc | string | 配置描述 |
| options | array/null | 可选值列表（如果有） |
| upload_to | string | 上传目录（GsImage 类型） |
| filename | string | 文件名模式（GsImage 类型） |
| suffix | string | 文件后缀（GsImage 类型） |

---

### 更新框架配置

更新框架配置（支持批量更新多个配置项）。

**请求**

```
POST /api/framework-config/{config_name}
```

**参数**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| config_name | string | 是 | 配置名称 |

**请求体**

```json
{
  "admin_list": ["123456", "789012"],
  "some_other_field": "value"
}
```

**响应**

```json
{
  "status": 0,
  "msg": "配置已保存"
}
```

---

### 更新单个框架配置项

更新单个框架配置的单个配置项（单个请求模式）。

**请求**

```
POST /api/framework-config/{config_name}/item/{item_name}
```

**参数**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| config_name | string | 是 | 配置名称 |
| item_name | string | 是 | 配置项名称 |

**请求体**

```json
{
  "value": "新的配置值"
}
```

**响应**

```json
{
  "status": 0,
  "msg": "配置项已保存"
}
```

**错误响应**

```json
{
  "status": 1,
  "msg": "配置项不存在"
}
```

或

```json
{
  "status": 1,
  "msg": "配置项写入失败"
}
```

---

## 插件商店 APIs

### 获取插件商店列表

获取可从远程商店安装的插件列表。

**请求**

```
GET /api/plugin-store/list
```

**响应**

```json
{
  "status": 0,
  "msg": "ok",
  "data": {
    "plugins": [
      {
        "id": "some_plugin",
        "name": "插件名称",
        "description": "插件描述",
        "version": "latest",
        "author": "作者",
        "tags": ["tag1", "tag2"],
        "icon": "",
        "cover": "",
        "avatar": "",
        "link": "https://github.com/...",
        "branch": "main",
        "type": "tip",
        "content": "普通",
        "info": "",
        "installMsg": "",
        "alias": [],
        "installed": false,
        "hasUpdate": false,
        "status": "not_installed"
      }
    ],
    "fun_plugins": ["fun1", "fun2"],
    "tool_plugins": ["tool1", "tool2"]
  }
}
```

---

### 安装插件

从商店安装插件。

**请求**

```
POST /api/plugin-store/install/{plugin_id}
```

**参数**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| plugin_id | string | 是 | 插件 ID |

**请求体**

```json
{
  "repo_url": "https://github.com/user/repo"
}
```

**响应**

```json
{
  "status": 0,
  "msg": "插件安装成功"
}
```

或错误响应：

```json
{
  "status": 1,
  "msg": "插件安装失败"
}
```

---

### 更新插件

更新已安装的插件。

**请求**

```
POST /api/plugin-store/update/{plugin_id}
```

**参数**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| plugin_id | string | 是 | 插件 ID |

**响应**

```json
{
  "status": 0,
  "msg": "插件更新成功"
}
```

或错误响应：

```json
{
  "status": 1,
  "msg": "插件更新失败"
}
```

---

### 卸载插件

卸载已安装的插件。

**请求**

```
DELETE /api/plugin-store/uninstall/{plugin_id}
```

**参数**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| plugin_id | string | 是 | 插件 ID |

**响应**

```json
{
  "status": 0,
  "msg": "卸载成功信息"
}
```

或错误响应：

```json
{
  "status": 1,
  "msg": "卸载失败信息"
}
```

---

## 角色配置 APIs

### 获取角色配置

获取指定角色的配置信息。

**请求**

```
GET /api/persona/{persona_name}/config
```

**请求头**

```
Authorization: Bearer <token>
```

**路径参数**

| 参数 | 类型 | 说明 |
|------|------|------|
| persona_name | string | 角色名称 |

**响应**

```json
{
    "status": 0,
    "msg": "ok",
    "data": {
        "ai_mode": ["提及应答"],
        "scope": "specific",
        "target_groups": ["群聊ID1", "群聊ID2"]
    }
}
```

**响应字段说明**

| 字段 | 类型 | 说明 |
|------|------|------|
| ai_mode | array | AI行动模式列表，可选值："提及应答", "定时巡检", "趣向捕捉(暂不可用)", "困境救场(暂不可用)" |
| scope | string | 启用范围，可选值："disabled"(不对任何群聊启用), "global"(对所有群/角色启用), "specific"(仅对指定群聊启用) |
| target_groups | array | 当 scope 为 "specific" 时，指定该人格对哪些群聊/角色启用 |

**错误响应**（配置不存在）

```json
{
    "status": 1,
    "msg": "角色 'xxx' 的配置不存在",
    "data": null
}
```

---

### 更新角色配置

更新指定角色的配置信息。

**请求**

```
PUT /api/persona/{persona_name}/config
```

**请求头**

```
Authorization: Bearer <token>
Content-Type: application/json
```

**路径参数**

| 参数 | 类型 | 说明 |
|------|------|------|
| persona_name | string | 角色名称 |

**请求体**

```json
{
    "ai_mode": ["提及应答", "定时巡检"],
    "scope": "specific",
    "target_groups": ["群聊ID1", "群聊ID2"]
}
```

**请求字段说明**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| ai_mode | array | 否 | AI行动模式列表 |
| scope | string | 否 | 启用范围，可选值："disabled", "global", "specific" |
| target_groups | array | 否 | 目标群聊/角色列表，当 scope 为 "specific" 时生效 |

**响应**

```json
{
    "status": 0,
    "msg": "已更新: scope: specific, target_groups: ['群聊ID1', '群聊ID2']",
    "data": {
        "ai_mode": ["提及应答", "定时巡检"],
        "scope": "specific",
        "target_groups": ["群聊ID1", "群聊ID2"]
    }
}
```

**错误响应**（角色不存在）

```json
{
    "status": 1,
    "msg": "角色 'xxx' 不存在",
    "data": null
}
```

**错误响应**（全局启用冲突）

```json
{
    "status": 1,
    "msg": "无法设置为对所有群/角色启用，因为 '其他角色名' 已配置为全局启用",
    "data": null
}
```

**⚠️ 重要提示**

> **全部人格中只能有一个配置为 "global"（对所有群/角色启用）**。如果尝试将多个角色同时设置为 "global"，后端会返回错误。
>
> 前端在设置 scope 为 "global" 时，应当：
> 1. 先调用 `GET /api/persona/config/global` 检查是否已有其他角色配置为全局启用
> 2. 如果存在冲突，提示用户先取消其他角色的全局启用设置
> 3. 或者提供切换功能，自动将其他角色的 scope 改为 "disabled" 或 "specific"

---

### 获取全局启用的角色

获取当前配置为全局启用的角色名称。

**请求**

```
GET /api/persona/config/global
```

**请求头**

```
Authorization: Bearer <token>
```

**响应**（存在全局启用的角色）

```json
{
    "status": 0,
    "msg": "ok",
    "data": "角色名称"
}
```

**响应**（没有全局启用的角色）

```json
{
    "status": 0,
    "msg": "ok",
    "data": null
}
```

---

### 获取所有角色配置

获取所有角色的配置信息。

**请求**

```
GET /api/persona/config/all
```

**请求头**

```
Authorization: Bearer <token>
```

**响应**

```json
{
    "status": 0,
    "msg": "ok",
    "data": {
        "角色名1": {
            "ai_mode": ["提及应答"],
            "scope": "global",
            "target_groups": []
        },
        "角色名2": {
            "ai_mode": ["定时巡检"],
            "scope": "specific",
            "target_groups": ["群聊ID1"]
        }
    }
}
```

---

## 通用响应格式

### 成功响应

```json
{
  "status": 0,
  "msg": "ok 或成功信息",
  "data": { ... }  // 可选
}
```

### 错误响应

```json
{
  "status": 1,
  "msg": "错误信息"
}
```

---

## 状态码说明

| 状态码 | 说明 |
|--------|------|
| 0 | 成功 |
| 1 | 失败/错误 |

---

## 配置类型说明

| 类型 | 说明 |
|------|------|
| str | 字符串类型 |
| int | 整数类型 |
| bool | 布尔类型 |
| float | 浮点数类型 |
| gsimage | 图片类型（支持上传） |
| list | 列表类型 |
| dict | 字典类型 |
