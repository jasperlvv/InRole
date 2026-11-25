import fs from 'node:fs/promises';
import path from 'node:path';
import {randomUUID,randomBytes} from 'node:crypto';
import {spawn} from 'node:child_process';
import {setTimeout as delay} from 'node:timers/promises';
import pg from 'pg';
import {state,databaseUrl,connect,migrate,permissions,root} from './common.mjs';
import {databaseFaultProxy} from './fault-proxy.mjs';
let bootstrap,owner,child,database,faultProxy,watcher;
await fs.mkdir(path.join(root,'.tmp/s16'),{recursive:true});
try{
const config=await state();bootstrap=await connect(databaseUrl(config,'postgres','inrole_bootstrap'));
database='inrole_verify_'+randomUUID().replaceAll('-','');
await bootstrap.query('CREATE DATABASE '+pg.escapeIdentifier(database)+' OWNER inrole_migrator');
await bootstrap.query('REVOKE ALL ON DATABASE '+pg.escapeIdentifier(database)+' FROM PUBLIC');
await bootstrap.query('GRANT CONNECT ON DATABASE '+pg.escapeIdentifier(database)+' TO inrole_app');
const direct=databaseUrl(config,database,'inrole_migrator');await migrate(direct);await permissions(direct);owner=await connect(direct);
const catalog=JSON.parse(await fs.readFile(path.join(root,'prisma/catalog.json'),'utf8'));
for(const tag of catalog.interests)await owner.query('INSERT INTO inrole.interest_tags(id,name) VALUES($1,$2)',[tag.id,tag.name]);
for(const p of catalog.people)await owner.query('INSERT INTO inrole.people(id,name,bio,"primaryInterestId","legacyAvatarPath","updatedAt") VALUES($1,$2,$3,$4,$5,now())',[p.id,p.name,p.bio,p.primaryInterestId,p.legacyAvatarPath]);
for(const t of catalog.topics)await owner.query('INSERT INTO inrole.topics(id,name,description) VALUES($1,$2,$3)',[t.id,t.name,t.description]);
faultProxy=await databaseFaultProxy(config.port);
const applicationUrl=new URL(databaseUrl(config,database,'inrole_app'));applicationUrl.port=String(faultProxy.port);
const controlFile=path.join(root,'.tmp/s16/control.json');await fs.writeFile(controlFile,JSON.stringify({offline:false}));
let lastOffline=false;watcher=setInterval(async()=>{try{const control=JSON.parse(await fs.readFile(controlFile,'utf8'));if(control.offline!==lastOffline){lastOffline=control.offline===true;faultProxy.setOffline(lastOffline);await fs.writeFile(path.join(root,'.tmp/s16/status.json'),JSON.stringify({offline:lastOffline}));}}catch{}},200);
const origin='http://localhost:3101',password=randomBytes(24).toString('base64url');
child=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port','3101'],{cwd:root,windowsHide:true,stdio:['ignore','pipe','pipe'],env:{...process.env,DATABASE_URL:applicationUrl.href,APP_ORIGIN:origin,SESSION_PASSWORD:randomBytes(48).toString('base64url'),RATE_LIMIT_SECRET:randomBytes(48).toString('base64url'),RECOVERY_CODE_PEPPER:randomBytes(48).toString('base64url'),MEDIA_STORAGE_ROOT:path.join(root,'.tmp/s16/browser-media')}});
let logs='';for(const stream of[child.stdout,child.stderr])stream.on('data',c=>{logs+=c});
for(let i=0;i<80;i++){try{if((await fetch(origin+'/live/login')).status===200)break}catch{}await delay(200);}
async function call(route,data,cookie,method='POST'){const r=await fetch(origin+route,{method,headers:{Origin:origin,'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{}),'Idempotency-Key':randomUUID()},body:JSON.stringify(data)});const b=await r.json();if(!r.ok)throw Error(route+' '+r.status);return {data:b.data,cookie:(r.headers.get('set-cookie')||'').split(';')[0]};}
const users={};for(const handle of['stage_reader','stage_author','stage_admin']){const user=await call('/api/v1/auth/register',{handle,password});users[handle]=user;await call('/api/v1/community/preferences',{interestIds:['science'],finishOnboarding:true},user.cookie,'PUT');}
await owner.query("UPDATE inrole.app_users SET role='ADMIN' WHERE handle='stage_admin'");
const post=(await call('/api/v1/community/posts',{personId:'libai',body:'【隔离验收】把普通的一天，写成值得回味的一句。',topicIds:['poetry']},users.stage_author.cookie)).data;
await call('/api/v1/community/posts/'+post.id+'/comments',{personId:'wukong',body:'【隔离验收】俺老孙来接一句。'},users.stage_reader.cookie);
await call('/api/v1/community/posts/'+post.id+'/like',{liked:true},users.stage_reader.cookie,'PUT');
await call('/api/v1/community/requests',{name:'测试人物申请',bio:'仅供隔离测试，结束后随测试库删除'},users.stage_reader.cookie);
await fs.writeFile(path.join(root,'.tmp/s16/browser-fixture.json'),JSON.stringify({origin,password,reader:'stage_reader',admin:'stage_admin',newUser:'s16_browser',postId:post.id,database}));
console.log('Isolated browser fixture ready on port 3101. Credentials saved only to ignored fixture file.');
await new Promise(resolve=>{process.once('SIGINT',resolve);process.once('SIGTERM',resolve);child.once('exit',resolve)});
await fs.writeFile(path.join(root,'.tmp/s16/browser-server.log'),logs);
}finally{clearInterval(watcher);if(child&&child.exitCode===null)child.kill();await faultProxy?.close();await owner?.end();if(bootstrap){if(/^inrole_verify_[a-f0-9]{32}$/.test(database||''))await bootstrap.query('DROP DATABASE IF EXISTS '+pg.escapeIdentifier(database)+' WITH (FORCE)');await bootstrap.end();}}
