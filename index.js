// ============================================================================
// 小麦片场 抖音云服务端（单一 HTTP 服务，按 action 分发）。
// 客户端：POST /api  body = { action, payload, code? }
// 返回：{ ok:true, data } 或 { ok:false, error }
//
// 写接口鉴权：客户端随请求带一个新鲜的 tt.login code，服务端用
// jscode2session 换 openid 再校验白名单（不信任客户端自报 openid）。
// ============================================================================
const express = require('express');
const axios = require('axios');
const { nanoid } = require('nanoid');
const db = require('./db.js');
const cos = require('./cos.js');

const app = express();
app.use(express.json({ limit: '8mb' })); // 封面走 base64，放宽体积

const APPID = process.env.DOUYIN_APPID || '';
const APP_SECRET = process.env.DOUYIN_APP_SECRET || '';
const ADMIN_OPENIDS = (process.env.ADMIN_OPENIDS || '')
  .split(',').map((s) => s.trim()).filter(Boolean);

const WRITE_ACTIONS = [
  'createPromptSet', 'updatePromptSet', 'setStatus',
  'deletePromptSet', 'uploadCover', 'listAllPromptSets', 'getAnyPromptSet'
];

// 健康检查（平台硬性要求 GET /v1/ping）
app.get('/v1/ping', (req, res) => res.status(200).send('pong'));
app.get('/health', (req, res) => res.json({ ok: true }));

app.post('/api', async (req, res) => {
  const body = req.body || {};
  const action = body.action;
  const payload = body.payload || {};

  try {
    // 写操作：先用 code 换 openid 并校验白名单
    if (WRITE_ACTIONS.indexOf(action) >= 0) {
      const openid = await openidFromCode(body.code);
      if (!isAdmin(openid)) {
        return res.json({ ok: false, error: '无权限：仅管理员可操作' });
      }
    }

    switch (action) {
      // ---------- 公开读 ----------
      case 'getPromptSet':
        return res.json({ ok: true, data: await getPromptSet(payload) });
      case 'listPromptSets':
        return res.json({ ok: true, data: await db.listPublished(payload) });

      // ---------- 登录：换 openid + 判断是否管理员 ----------
      case 'login': {
        const openid = await openidFromCode(payload.code);
        const admin = isAdmin(openid);
        // 调试：用 JSON.stringify 暴露隐藏空格/字符差异
        console.log('[login] openid=' + JSON.stringify(openid)
          + ' isAdmin=' + admin
          + ' whitelist=' + JSON.stringify(ADMIN_OPENIDS));
        return res.json({ ok: true, data: { openid: openid, isAdmin: admin } });
      }

      // ---------- 管理写 ----------
      case 'createPromptSet':
        return res.json({ ok: true, data: await createPromptSet(payload) });
      case 'updatePromptSet':
        return res.json({ ok: true, data: await updatePromptSet(payload) });
      case 'setStatus':
        return res.json({ ok: true, data: await setStatus(payload) });
      case 'deletePromptSet':
        return res.json({ ok: true, data: await db.remove(payload.id) });
      case 'uploadCover':
        return res.json({ ok: true, data: await uploadCover(payload) });
      case 'listAllPromptSets':
        return res.json({ ok: true, data: await db.listAll() });
      case 'getAnyPromptSet':
        return res.json({ ok: true, data: await db.getById(payload.id) });

      default:
        return res.json({ ok: false, error: '未知 action：' + String(action) });
    }
  } catch (e) {
    return res.json({ ok: false, error: String((e && e.message) || e) });
  }
});

// ---------- 业务 ----------

async function getPromptSet(payload) {
  const id = payload && payload.id;
  if (!id) throw new Error('缺少 id');
  const set = await db.getById(id);
  if (!set || set.status !== 'published') return null; // 公开只给已上映
  db.incrViewCount(id);
  return set;
}

function normalizePrompts(prompts) {
  const arr = Array.isArray(prompts) ? prompts : [];
  return arr.map((p, i) => ({
    order: i + 1,
    label: p.label || '',
    content: String(p.content || ''),
    duration: String(p.duration || '')
  }));
}

async function createPromptSet(payload) {
  const now = Date.now();
  const doc = {
    id: nanoid(8),
    title: String(payload.title || '').trim(),
    coverUrl: String(payload.coverUrl || ''),
    description: String(payload.description || ''),
    category: payload.category || '',
    prompts: normalizePrompts(payload.prompts),
    status: payload.status === 'published' ? 'published' : 'draft',
    viewCount: 0,
    createdAt: now,
    updatedAt: now
  };
  if (!doc.title) throw new Error('缺少作品名');
  if (!doc.prompts.length) throw new Error('至少要有 1 个分镜');
  await db.insert(doc);
  return { id: doc.id };
}

async function updatePromptSet(payload) {
  const id = payload.id;
  if (!id) throw new Error('缺少 id');
  const fields = { updatedAt: Date.now() };
  if (payload.title !== undefined) fields.title = String(payload.title).trim();
  if (payload.coverUrl !== undefined) fields.coverUrl = String(payload.coverUrl);
  if (payload.description !== undefined) fields.description = String(payload.description);
  if (payload.category !== undefined) fields.category = payload.category;
  if (payload.status !== undefined) fields.status = payload.status === 'published' ? 'published' : 'draft';
  if (payload.prompts !== undefined) fields.prompts = normalizePrompts(payload.prompts);
  await db.update(id, fields);
  return { ok: true };
}

async function setStatus(payload) {
  const id = payload.id;
  const status = payload.status === 'published' ? 'published' : 'draft';
  if (!id) throw new Error('缺少 id');
  await db.update(id, { status: status, updatedAt: Date.now() });
  return { ok: true };
}

async function uploadCover(payload) {
  const dataBase64 = payload.dataBase64 || '';
  const ext = (payload.ext || 'jpg').replace(/[^a-zA-Z0-9]/g, '') || 'jpg';
  if (!dataBase64) throw new Error('缺少图片数据');
  const buf = Buffer.from(dataBase64, 'base64');
  const key = 'covers/' + nanoid(12) + '.' + ext;
  const url = await cos.putObject(key, buf, ext);
  return { coverUrl: url };
}

// ---------- 鉴权 ----------

// 用 tt.login 的 code 换 openid
async function openidFromCode(code) {
  if (!code) throw new Error('缺少登录 code');
  if (!APPID || !APP_SECRET) throw new Error('服务端未配置 DOUYIN_APPID / DOUYIN_APP_SECRET');
  const resp = await axios.post(
    'https://developer.toutiao.com/api/apps/v2/jscode2session',
    { appid: APPID, secret: APP_SECRET, code: code },
    { timeout: 8000, headers: { 'content-type': 'application/json' } }
  );
  const d = resp.data || {};
  if (d.err_no && d.err_no !== 0) {
    throw new Error('登录失败：' + (d.err_tips || ('err_no ' + d.err_no)));
  }
  const openid = d.data && d.data.openid;
  if (!openid) throw new Error('登录失败：未取到 openid');
  return openid;
}

function isAdmin(openid) {
  return !!openid && ADMIN_OPENIDS.indexOf(openid) >= 0;
}

const port = process.env.PORT || 8000;
app.listen(port, () => {
  console.log('[xiaomai-api] listening on ' + port + ', admins=' + ADMIN_OPENIDS.length);
  db.seedIfNeeded().catch((e) => console.warn('[db] seed skipped:', String(e.message || e)));
});
