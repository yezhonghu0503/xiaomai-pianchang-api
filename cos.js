// 腾讯云 COS 上传封面。密钥从环境变量读取，绝不进客户端：
//   COS_SECRET_ID, COS_SECRET_KEY, COS_BUCKET（形如 name-1250000000）, COS_REGION（如 ap-guangzhou）
// 桶需允许公有读，或这里以 public-read ACL 上传，返回公网可访问 URL。
const COS = require('cos-nodejs-sdk-v5');

let _cos = null;
function client() {
  if (_cos) return _cos;
  const SecretId = process.env.COS_SECRET_ID;
  const SecretKey = process.env.COS_SECRET_KEY;
  if (!SecretId || !SecretKey) throw new Error('服务端未配置 COS_SECRET_ID / COS_SECRET_KEY');
  _cos = new COS({ SecretId: SecretId, SecretKey: SecretKey });
  return _cos;
}

const extToMime = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
  webp: 'image/webp', gif: 'image/gif'
};

function putObject(key, buffer, ext) {
  const Bucket = process.env.COS_BUCKET;
  const Region = process.env.COS_REGION;
  if (!Bucket || !Region) throw new Error('服务端未配置 COS_BUCKET / COS_REGION');
  const c = client();
  return new Promise((resolve, reject) => {
    c.putObject(
      {
        Bucket: Bucket,
        Region: Region,
        Key: key,
        Body: buffer,
        ACL: 'public-read',
        ContentType: extToMime[(ext || '').toLowerCase()] || 'image/jpeg'
      },
      (err) => {
        if (err) return reject(new Error('COS 上传失败：' + (err.message || err)));
        resolve('https://' + Bucket + '.cos.' + Region + '.myqcloud.com/' + key);
      }
    );
  });
}

module.exports = { putObject };
