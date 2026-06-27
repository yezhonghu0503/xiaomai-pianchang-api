// ============================================================================
// 数据库访问适配层 —— 全项目唯一直接依赖「抖音云云数据库 SDK」的文件。
//
// ⚠ TODO(对齐模板)：抖音云在你「新建服务」时会生成模板代码与 package.json，
//   其中包含「抖音云云数据库 npm 包」。该包的【确切包名】与【初始化/查询 API】
//   需以你那边生成的模板为准。下面 realDb() 里用注释标出了需要替换的两处。
//   建好服务后把生成的 db 包名与用法贴给我，我据此把 realDb() 补成可用版本。
//
// 在 db 接好之前：把环境变量 USE_MOCK_DB 设为 "1"，即可用内置示例数据先跑通
//   「客户端 → callContainer → 服务端路由 → 返回」整条链路（阶段 1 验收第一步）。
// ============================================================================

const COLLECTION = 'prompt_sets';

// ---- MOCK 数据（仅在 USE_MOCK_DB=1 时启用）---------------------------------
// 注：category 为可选分类字段（运镜/场景/转场），用于首页分类 chips；旧数据可不带。
const MOCK_SETS = [
  {
    id: 'a8Kd2x',
    title: '赛博朋克城市夜景运镜',
    coverUrl: 'https://via.placeholder.com/750x420.png?text=赛博夜景',
    description: '用即梦/可灵生成的赛博城市夜景，含 3 个分镜',
    category: '运镜',
    status: 'published',
    viewCount: 128,
    createdAt: 1751000000000,
    updatedAt: 1751000000000,
    prompts: [
      { order: 1, label: '分镜1·开场推镜', content: '霓虹灯城市夜景，雨后湿润街道反光，镜头缓慢向前推进，赛博朋克风格，电影感，4K', duration: '5秒' },
      { order: 2, label: '分镜2·环绕镜头', content: '围绕一座高楼环绕运镜，全息广告牌，蓝紫色调，体积光', duration: '3-5秒' },
      { order: 3, label: '分镜3·收尾拉远', content: '镜头快速拉远展示整座城市天际线，无人机视角，夜晚', duration: '4秒' }
    ]
  },
  {
    id: 'b3Lm7q',
    title: '古风庭院唯美场景',
    coverUrl: 'https://via.placeholder.com/750x420.png?text=古风庭院',
    description: '水墨质感的古风庭院，适合开场氛围铺垫',
    category: '场景',
    status: 'published',
    viewCount: 86,
    createdAt: 1752200000000,
    updatedAt: 1752200000000,
    prompts: [
      { order: 1, label: '分镜1·庭院全景', content: '中式古典庭院，青砖黛瓦，雕花木窗，庭中一株海棠，晨雾缭绕，国风水墨质感，柔光', duration: '4秒' },
      { order: 2, label: '分镜2·细节特写', content: '特写海棠花瓣上的露珠滴落，浅景深，逆光，唯美氛围', duration: '3秒' }
    ]
  },
  {
    id: 'c9Rt2w',
    title: '丝滑无缝转场合集',
    coverUrl: 'https://via.placeholder.com/750x420.png?text=转场合集',
    description: '4 组常用无缝转场提示词，剪辑必备',
    category: '转场',
    status: 'published',
    viewCount: 203,
    createdAt: 1753400000000,
    updatedAt: 1753400000000,
    prompts: [
      { order: 1, label: '分镜1·甩镜转场', content: '镜头快速向左甩动产生运动模糊，画面切换到下一场景，动感转场', duration: '1秒' },
      { order: 2, label: '分镜2·遮罩转场', content: '人物走过遮挡镜头，借遮挡物完成画面切换，无缝衔接', duration: '2秒' },
      { order: 3, label: '分镜3·缩放转场', content: '镜头急速推近至物体表面，再拉出到新场景，缩放过渡', duration: '1-2秒' },
      { order: 4, label: '分镜4·光效转场', content: '强光过曝充满画面后回落，切换到新场景，梦幻光效转场', duration: '1秒' }
    ]
  },
  {
    id: 'd5Yx8k',
    title: '无人机航拍开场运镜',
    coverUrl: 'https://via.placeholder.com/750x420.png?text=航拍运镜',
    description: '大气磅礴的航拍开场，适合系列片头',
    category: '运镜',
    status: 'published',
    viewCount: 57,
    createdAt: 1754600000000,
    updatedAt: 1754600000000,
    prompts: [
      { order: 1, label: '分镜1·穿云俯冲', content: '无人机视角穿过云层向下俯冲，露出壮阔山川，电影级航拍，宽幅，4K', duration: '5秒' },
      { order: 2, label: '分镜2·贴地飞行', content: '镜头贴着水面/草地高速前进，两侧景物飞速掠过，速度感', duration: '4秒' }
    ]
  }
];

const useMock = () => process.env.USE_MOCK_DB === '1';

// ---- 真实数据库实现（待对齐模板后启用）------------------------------------
function realDb() {
  // TODO(对齐模板) ①：替换为模板生成的抖音云云数据库包名与初始化方式。
  //   形如：const { Database } = require('<抖音云数据库包名>');
  //         const db = new Database({ ... }) 或 SDK 提供的工厂方法。
  throw new Error('REAL_DB_NOT_WIRED：请先对齐抖音云云数据库 SDK（db.js realDb），或设 USE_MOCK_DB=1');
}

// ---- 对外接口（业务层只认这几个函数，与底层 SDK 解耦）---------------------

// 按 id 取一条（仅返回存在的记录，不限制 status；status 过滤交给业务层决定）
async function getById(id) {
  if (useMock()) {
    return MOCK_SETS.find((s) => s.id === id) || null;
  }
  const db = realDb();
  // TODO(对齐模板) ②：用模板 SDK 的查询链替换。文档型常见形态示例：
  //   const r = await db.collection(COLLECTION).where({ id }).limit(1).get();
  //   return (r && r.data && r.data[0]) || null;
  return null;
}

// 列表（仅 published，可按 title 关键词过滤）—— 阶段 3 用
async function listPublished({ keyword = '', page = 1, pageSize = 20 } = {}) {
  if (useMock()) {
    return MOCK_SETS
      .filter((s) => s.status === 'published')
      .filter((s) => (keyword ? s.title.indexOf(keyword) >= 0 : true));
  }
  const db = realDb();
  // TODO(对齐模板)：用模板 SDK 实现 where(status=published) + 模糊匹配 + 分页。
  return [];
}

// 自增浏览次数（getPromptSet 时调用；失败不影响主流程）
async function incrViewCount(id) {
  if (useMock()) return;
  try {
    const db = realDb();
    // TODO(对齐模板)：db.collection(COLLECTION).where({ id }).update({ viewCount: _.inc(1) }) 之类
  } catch (e) {
    // 静默：浏览计数失败不应阻断详情返回
  }
}

module.exports = {
  COLLECTION,
  getById,
  listPublished,
  incrViewCount
};
