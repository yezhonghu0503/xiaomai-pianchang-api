// ============================================================================
// 小麦片场 抖音云服务端（单一 HTTP 服务，按 action 分发）。
//
// 抖音云的「服务/云函数」是运行在容器里的 HTTP 服务，客户端用 callContainer
// 按 path 调进来。这里用 Express 监听 process.env.PORT，对外只暴露 /api。
// 客户端约定：POST /api  body = { action, payload }
// 返回约定：{ ok: true, data } 或 { ok: false, error }
//
// ⚠ 入口脚手架（Express + PORT 监听）匹配抖音云 Node.js 服务的常见模板。
//   若你建服务时生成的模板入口形态不同，把模板入口贴我，我据此微调（业务逻辑不变）。
// ============================================================================

const express = require('express');
const db = require('./db.js');

const app = express();
app.use(express.json({ limit: '2mb' }));

// 管理员 openid 白名单：仅从环境变量读取，绝不进客户端（MVP 文档 8.3）。
const ADMIN_OPENIDS = (process.env.ADMIN_OPENIDS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

// 健康检查
app.get('/health', (req, res) => res.json({ ok: true }));

// 统一入口
app.post('/api', async (req, res) => {
  const body = req.body || {};
  const action = body.action;
  const payload = body.payload || {};

  try {
    switch (action) {
      // ---------- 公开读接口（阶段 1/2/3） ----------
      case 'getPromptSet': {
        const set = await getPromptSet(payload);
        return res.json({ ok: true, data: set });
      }
      case 'listPromptSets': {
        const list = await db.listPublished(payload);
        return res.json({ ok: true, data: list });
      }

      // ---------- 管理写接口（阶段 4 实现，此处先占位 + 鉴权骨架） ----------
      case 'createPromptSet':
      case 'updatePromptSet':
      case 'setStatus':
      case 'deletePromptSet':
      case 'uploadCover':
      case 'login':
        return res.json({ ok: false, error: '该接口将在阶段 4 实现：' + action });

      default:
        return res.json({ ok: false, error: '未知 action：' + String(action) });
    }
  } catch (e) {
    return res.json({ ok: false, error: String((e && e.message) || e) });
  }
});

// ---------- 业务逻辑 ----------

async function getPromptSet(payload) {
  const id = payload && payload.id;
  if (!id) throw new Error('缺少 id');
  const set = await db.getById(id);
  // 公开详情只返回已上映作品；草稿/封存视为不存在
  if (!set || set.status !== 'published') return null;
  // 浏览计数 +1（失败不影响返回）
  db.incrViewCount(id);
  return set;
}

// ---------- 鉴权骨架（阶段 4 写接口启用） ----------
// 抖音云会把调用方信息透传到服务端；获取 openid 的确切方式（header 字段名等）
// 需对齐抖音云文档，阶段 4 接入 login/写接口时再落地。
// eslint-disable-next-line no-unused-vars
function isAdmin(openid) {
  return !!openid && ADMIN_OPENIDS.indexOf(openid) >= 0;
}

const port = process.env.PORT || 8000;
app.listen(port, () => {
  console.log('[xiaomai-api] listening on ' + port + ', admins=' + ADMIN_OPENIDS.length);
});
