const argon2 = require('argon2');
const hash = '$argon2id$v=19$m=65536,t=3,p=4$J39nlx2rYaIahnXn2daWrQ$VC1uzAvcucVwMgNWnRlCWWERYq3PxqqPxd6on+LLl0E';
const words = ['password','Password1','admin','demo','test','changeme','secret','12345678','P@ssw0rd','owner','gym123','demo123','Demo123','DemoGym','fitadmin','Fit@123','demo@gym','fitness','welcome','password123','Admin@123','demo@123','DemoGym@123','fit123','owner123'];

(async () => {
  for (const w of words) {
    try {
      if (await argon2.verify(hash, w)) {
        console.log('MATCH FOUND:', w);
        return;
      }
    } catch(e) {
      console.log('Error with', w, ':', e.message);
      return;
    }
  }
  console.log('No match found in common passwords');
})();
