# 分类层级树 API 修改文档

## 问题描述

前端【分类】页签需要展示分类的层级关系（父分类 -> 子分类）。当前 API 返回的 `Category` 数据中缺少 `parent_id` 字段，导致前端无法构建正确的树形结构。

## 当前 Category 数据结构

```typescript
interface Category {
  id: string;
  scope_key: string;
  name: string;
  summary: string;
  tag: string[];
  layer: number;
  child_categories_count: number;  // 子分类数量（有值）
  member_entities_count: number;
  created_at: string;
  updated_at: string;
}
```

**问题**：`child_categories` 数组在 API 响应中始终为空，即使 `child_categories_count > 0`。

## 修改后的 Category 数据结构

```typescript
interface Category {
  id: string;
  scope_key: string;
  name: string;
  summary: string;
  tag: string[];
  layer: number;
  parent_id: string | null;        // 新增：父分类 ID，根分类为 null
  child_categories_count: number;
  member_entities_count: number;
  created_at: string;
  updated_at: string;
}
```

## 需要后端修改的 API

### 1. `GET /api/memory/categories` (getCategories)

**响应**中添加 `parent_id` 字段：

```json
{
  "items": [
    {
      "id": "cat_001",
      "scope_key": "default",
      "name": "工作",
      "summary": "工作相关内容",
      "tag": ["work", "job"],
      "layer": 1,
      "parent_id": null,                    // 新增：根分类
      "child_categories_count": 2,
      "member_entities_count": 15,
      "created_at": "2024-01-01T00:00:00Z",
      "updated_at": "2024-01-01T00:00:00Z"
    },
    {
      "id": "cat_002",
      "scope_key": "default",
      "name": "项目A",
      "summary": "项目A相关",
      "tag": ["project-a"],
      "layer": 2,
      "parent_id": "cat_001",               // 新增：父分类 ID
      "child_categories_count": 0,
      "member_entities_count": 8,
      "created_at": "2024-01-01T00:00:00Z",
      "updated_at": "2024-01-01T00:00:00Z"
    }
  ],
  "total": 100,
  "page": 1,
  "page_size": 20
}
```

### 2. `GET /api/memory/categories/:id` (getCategoryDetail)

如果此 API 仍被使用，也需要添加 `parent_id` 字段。

## 前端改动

前端已修改完成，使用 `parent_id` 字段构建树形结构：

1. **Category 接口**：添加 `parent_id: string | null` 字段
2. **CategoryLayerTree**：从初始分类列表构建树，不再依赖 `getCategoryDetail` API
3. **CategoryTreeNode**：递归组件，支持展开/折叠子分类

## 层级规则

- `layer` 值越小越接近顶层（Layer 1 是最底层，Layer 3 是最顶层）
- `parent_id` 指向父分类的 ID
- 根分类的 `parent_id` 为 `null`
- 子分类的 `layer` 值 = 父分类的 `layer` 值 + 1
