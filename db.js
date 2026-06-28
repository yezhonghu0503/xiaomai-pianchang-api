// ============================================================================
// 数据库访问层 —— 唯一直接依赖数据库驱动的文件。
//
// 方案：MongoDB（Atlas 免费云或自建均可）。PromptSet 本身是 JSON 文档，直接落库。
// 连接串等敏感信息从抖音云「环境变量」读取，绝不进客户端、绝不写死在代码里：
//   - MONGODB_URI   必填，Atlas 给的连接串（含用户名/密码）
//   - MONGODB_DB    可选，库名，默认 xiaomai
//   - USE_MOCK_DB=1 可选，临时用内置示例数据（不连库），用于链路自测
// ============================================================================
const { MongoClient } = require('mongodb');

const COLLECTION = 'prompt_sets';
const DB_NAME = process.env.MONGODB_DB || 'xiaomai';

// serverless/多实例下复用连接：缓存 connect() 的 Promise，避免每次请求重连
let _clientPromise = null;
function getClient() {
  if (_clientPromise) return _clientPromise;
  const uri = process.env.MONGODB_URI;
  if (!uri) return Promise.reject(new Error('缺少环境变量 MONGODB_URI'));
  const client = new MongoClient(uri, { maxPoolSize: 5, serverSelectionTimeoutMS: 8000 });
  _clientPromise = client.connect();
  return _clientPromise;
}
async function coll() {
  const client = await getClient();
  return client.db(DB_NAME).collection(COLLECTION);
}

const useMock = () => process.env.USE_MOCK_DB === '1';

// 正则转义，防止关键词里的特殊字符破坏查询
function escapeRegExp(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// 不向客户端返回 Mongo 的内部 _id
const NO_ID = { projection: { _id: 0 } };

// ---- 读 ----

async function getById(id) {
  if (useMock()) return MOCK_SETS.find((s) => s.id === id) || null;
  const c = await coll();
  return c.findOne({ id: id }, NO_ID);
}

async function listPublished({ keyword = '', page = 1, pageSize = 50 } = {}) {
  if (useMock()) {
    return MOCK_SETS
      .filter((s) => s.status === 'published')
      .filter((s) => (keyword ? s.title.indexOf(keyword) >= 0 : true));
  }
  const c = await coll();
  const q = { status: 'published' };
  if (keyword) q.title = { $regex: escapeRegExp(keyword), $options: 'i' };
  const skip = Math.max(0, (page - 1) * pageSize);
  return c.find(q, NO_ID).sort({ createdAt: -1 }).skip(skip).limit(pageSize).toArray();
}

async function incrViewCount(id) {
  if (useMock()) return;
  try {
    const c = await coll();
    await c.updateOne({ id: id }, { $inc: { viewCount: 1 } });
  } catch (e) {
    // 浏览计数失败不应阻断详情返回
  }
}

// ---- 写（阶段 4 管理端使用；此处先备好，index.js 接入鉴权后调用）----

async function insert(doc) {
  const c = await coll();
  await c.insertOne(doc);
  return doc.id;
}

async function update(id, fields) {
  const c = await coll();
  await c.updateOne({ id: id }, { $set: fields });
  return true;
}

async function remove(id) {
  const c = await coll();
  await c.deleteOne({ id: id });
  return true;
}

// 含草稿/封存的全量（管理端列表用）
async function listAll() {
  const c = await coll();
  return c.find({}, NO_ID).sort({ createdAt: -1 }).toArray();
}

// 幂等播种（SEED_ON_START=1 时启动调用）：建唯一索引 + 仅在缺失时插入示例。
// $setOnInsert 保证重复运行不会覆盖你后续编辑过的数据。
async function seedIfNeeded() {
  if (process.env.SEED_ON_START !== '1') return;
  const c = await coll();
  await c.createIndex({ id: 1 }, { unique: true });
  for (const doc of MOCK_SETS) {
    await c.updateOne({ id: doc.id }, { $setOnInsert: doc }, { upsert: true });
  }
  console.log('[db] seedIfNeeded done');
}

// ---- 内置示例数据（仅 USE_MOCK_DB=1 启用；也是 seed JSON 的来源）----
const MOCK_SETS = [
  {
    id: 'a8Kd2x', title: '赛博朋克城市夜景运镜',
    coverUrl: 'https://via.placeholder.com/750x420.png?text=赛博夜景',
    description: '用即梦/可灵生成的赛博城市夜景，含 3 个分镜',
    category: '运镜', status: 'published', viewCount: 128,
    createdAt: 1751000000000, updatedAt: 1751000000000,
    prompts: [
      { order: 1, label: '分镜1·开场推镜', content: '霓虹灯城市夜景，雨后湿润街道反光，镜头缓慢向前推进，赛博朋克风格，电影感，4K', duration: '5秒' },
      { order: 2, label: '分镜2·环绕镜头', content: '围绕一座高楼环绕运镜，全息广告牌，蓝紫色调，体积光', duration: '3-5秒' },
      { order: 3, label: '分镜3·收尾拉远', content: '镜头快速拉远展示整座城市天际线，无人机视角，夜晚', duration: '4秒' }
    ]
  },
  {
    id: 'b3Lm7q', title: '古风庭院唯美场景',
    coverUrl: 'https://via.placeholder.com/750x420.png?text=古风庭院',
    description: '水墨质感的古风庭院，适合开场氛围铺垫',
    category: '场景', status: 'published', viewCount: 86,
    createdAt: 1752200000000, updatedAt: 1752200000000,
    prompts: [
      { order: 1, label: '分镜1·庭院全景', content: '中式古典庭院，青砖黛瓦，雕花木窗，庭中一株海棠，晨雾缭绕，国风水墨质感，柔光', duration: '4秒' },
      { order: 2, label: '分镜2·细节特写', content: '特写海棠花瓣上的露珠滴落，浅景深，逆光，唯美氛围', duration: '3秒' }
    ]
  },
  {
    id: 'c9Rt2w', title: '丝滑无缝转场合集',
    coverUrl: 'https://via.placeholder.com/750x420.png?text=转场合集',
    description: '4 组常用无缝转场提示词，剪辑必备',
    category: '转场', status: 'published', viewCount: 203,
    createdAt: 1753400000000, updatedAt: 1753400000000,
    prompts: [
      { order: 1, label: '分镜1·甩镜转场', content: '镜头快速向左甩动产生运动模糊，画面切换到下一场景，动感转场', duration: '1秒' },
      { order: 2, label: '分镜2·遮罩转场', content: '人物走过遮挡镜头，借遮挡物完成画面切换，无缝衔接', duration: '2秒' },
      { order: 3, label: '分镜3·缩放转场', content: '镜头急速推近至物体表面，再拉出到新场景，缩放过渡', duration: '1-2秒' },
      { order: 4, label: '分镜4·光效转场', content: '强光过曝充满画面后回落，切换到新场景，梦幻光效转场', duration: '1秒' }
    ]
  },
  {
    id: 'd5Yx8k', title: '无人机航拍开场运镜',
    coverUrl: 'https://via.placeholder.com/750x420.png?text=航拍运镜',
    description: '大气磅礴的航拍开场，适合系列片头',
    category: '运镜', status: 'published', viewCount: 57,
    createdAt: 1754600000000, updatedAt: 1754600000000,
    prompts: [
      { order: 1, label: '分镜1·穿云俯冲', content: '无人机视角穿过云层向下俯冲，露出壮阔山川，电影级航拍，宽幅，4K', duration: '5秒' },
      { order: 2, label: '分镜2·贴地飞行', content: '镜头贴着水面/草地高速前进，两侧景物飞速掠过，速度感', duration: '4秒' }
    ]
  },
  {
    id: 'e7Zp4n', title: '赛博女主角色设定',
    coverUrl: 'https://via.placeholder.com/750x420.png?text=角色设定',
    description: '一致性角色设计提示词，多角度还原同一人物',
    category: '角色设计', status: 'published', viewCount: 142,
    createdAt: 1755800000000, updatedAt: 1755800000000,
    prompts: [
      { order: 1, label: '分镜1·正面定妆', content: '20 岁亚洲女性，银色短发，蓝色机械义眼，黑色科技感外套，正面半身，影棚布光，超写实，8K', duration: '—' },
      { order: 2, label: '分镜2·侧面三视图', content: '同一角色，左侧 45 度、正侧、背面三视图，统一发型与服装，角色设定图，参考表', duration: '—' },
      { order: 3, label: '分镜3·表情集', content: '同一角色，喜怒哀乐四种表情，统一画风，表情参考板', duration: '—' }
    ]
  },
  {
    id: 'f2Wb9s', title: '国风少年角色三视图',
    coverUrl: 'https://via.placeholder.com/750x420.png?text=国风少年',
    description: '古风少年角色一致性设定，适合系列短剧',
    category: '角色设计', status: 'published', viewCount: 73,
    createdAt: 1756900000000, updatedAt: 1756900000000,
    prompts: [
      { order: 1, label: '分镜1·人物立绘', content: '古风少年，束发长袍，剑眉星目，手持折扇，全身立绘，国风工笔，干净背景', duration: '—' },
      { order: 2, label: '分镜2·服装细节', content: '同一角色服装细节特写：刺绣纹样、腰带、配饰，保持配色一致', duration: '—' }
    ]
  }
];

module.exports = {
  COLLECTION,
  getById,
  listPublished,
  incrViewCount,
  insert,
  update,
  remove,
  listAll,
  seedIfNeeded
};
