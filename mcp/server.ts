#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

const TOKEN = process.env.MEMENTO_MORI_TOKEN;
const BASE_URL = process.env.MEMENTO_MORI_URL || "https://memento-mori-v2.vercel.app";

if (!TOKEN) {
  console.error("MEMENTO_MORI_TOKEN environment variable is required");
  process.exit(1);
}

const api = async (method: string, path: string, body?: object) => {
  const res = await fetch(`${BASE_URL}/api/share/${TOKEN}${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
};

const server = new Server(
  { name: "memento-mori", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "get_life_profile",
      description: "ユーザーの人生プロフィール（残り時間・バケットリスト・目標・メモなど）を取得します",
      inputSchema: { type: "object", properties: {} },
    },
    {
      name: "list_bucket_items",
      description: "バケットリスト（やりたいことリスト）の一覧を取得します",
      inputSchema: { type: "object", properties: {} },
    },
    {
      name: "add_bucket_item",
      description: "バケットリストに新しい項目を追加します",
      inputSchema: {
        type: "object",
        properties: { text: { type: "string", description: "追加するバケットアイテムのテキスト" } },
        required: ["text"],
      },
    },
    {
      name: "complete_bucket_item",
      description: "バケットリストの項目を完了済みにします",
      inputSchema: {
        type: "object",
        properties: { id: { type: "string", description: "バケットアイテムのID" } },
        required: ["id"],
      },
    },
    {
      name: "update_bucket_item",
      description: "バケットリストの項目のテキストを更新します",
      inputSchema: {
        type: "object",
        properties: {
          id: { type: "string", description: "バケットアイテムのID" },
          text: { type: "string", description: "新しいテキスト" },
        },
        required: ["id", "text"],
      },
    },
    {
      name: "delete_bucket_item",
      description: "バケットリストの項目を削除します",
      inputSchema: {
        type: "object",
        properties: { id: { type: "string", description: "バケットアイテムのID" } },
        required: ["id"],
      },
    },
    {
      name: "add_memo",
      description: "メモを追加します（最新50件が保持されます）",
      inputSchema: {
        type: "object",
        properties: { content: { type: "string", description: "メモの内容" } },
        required: ["content"],
      },
    },
    {
      name: "update_notes",
      description: "ノート（長文メモ）を更新します",
      inputSchema: {
        type: "object",
        properties: { notes: { type: "string", description: "新しいノートの内容" } },
        required: ["notes"],
      },
    },
    {
      name: "update_decade_goal",
      description: "特定の年代（20代・30代など）の目標を更新します",
      inputSchema: {
        type: "object",
        properties: {
          decadeKey: { type: "string", description: "年代キー（例: '20', '30', '40'）" },
          goal: { type: "string", description: "その年代の目標テキスト" },
        },
        required: ["decadeKey", "goal"],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "get_life_profile": {
        const profile = await api("GET", "");
        return { content: [{ type: "text", text: JSON.stringify(profile, null, 2) }] };
      }
      case "list_bucket_items": {
        const profile = await api("GET", "");
        return { content: [{ type: "text", text: JSON.stringify(profile.bucketList ?? [], null, 2) }] };
      }
      case "add_bucket_item": {
        const item = await api("POST", "/bucket", { text: (args as any).text });
        return { content: [{ type: "text", text: `追加しました: ${JSON.stringify(item)}` }] };
      }
      case "complete_bucket_item": {
        await api("PATCH", `/bucket/${(args as any).id}`, { completed: true });
        return { content: [{ type: "text", text: "完了にしました" }] };
      }
      case "update_bucket_item": {
        await api("PATCH", `/bucket/${(args as any).id}`, { text: (args as any).text });
        return { content: [{ type: "text", text: "更新しました" }] };
      }
      case "delete_bucket_item": {
        await api("DELETE", `/bucket/${(args as any).id}`);
        return { content: [{ type: "text", text: "削除しました" }] };
      }
      case "add_memo": {
        const memo = await api("POST", "/memo", { content: (args as any).content });
        return { content: [{ type: "text", text: `メモを追加しました: ${JSON.stringify(memo)}` }] };
      }
      case "update_notes": {
        await api("PUT", "/notes", { notes: (args as any).notes });
        return { content: [{ type: "text", text: "ノートを更新しました" }] };
      }
      case "update_decade_goal": {
        await api("PUT", "/goals", { decadeKey: (args as any).decadeKey, goal: (args as any).goal });
        return { content: [{ type: "text", text: `${(args as any).decadeKey}代の目標を更新しました` }] };
      }
      default:
        return { content: [{ type: "text", text: `Unknown tool: ${name}` }], isError: true };
    }
  } catch (err: any) {
    return { content: [{ type: "text", text: `エラー: ${err.message}` }], isError: true };
  }
});

const transport = new StdioServerTransport();
server.connect(transport);
