import {createRequire} from 'node:module';
import {mkdirSync} from 'node:fs';
import path from 'node:path';
import {randomBytes,randomUUID,scrypt,timingSafeEqual,createHash} from 'node:crypto';
import {promisify} from 'node:util';
import type {ProfileState} from './profile';
type SQLValue=string|number|null;
type Statement={get:(...values:SQLValue[])=>Record<string,unknown>|undefined;run:(...values:SQLValue[])=>unknown};
type Database={exec:(sql:string)=>void;prepare:(sql:string)=>Statement};
const {DatabaseSync}=createRequire(import.meta.url)('node:sqlite') as {DatabaseSync:new(file:string)=>Database};
const derive=promisify(scrypt);let connection:Database|undefined;
function db(){if(connection)return connection;const folder=path.resolve(process.env.COURSEPLAN_DATA_DIR||'.local-data');mkdirSync(folder,{recursive:true});connection=new DatabaseSync(path.join(folder,'courseplan.sqlite'));
 connection.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
 CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,email TEXT NOT NULL UNIQUE,password_hash TEXT NOT NULL,profile_json TEXT,created_at INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS sessions(token_hash TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,expires_at INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS workspaces(user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,program_id TEXT NOT NULL,payload TEXT NOT NULL,updated_at INTEGER NOT NULL,PRIMARY KEY(user_id,program_id));
 CREATE TABLE IF NOT EXISTS login_limits(key TEXT PRIMARY KEY,attempts INTEGER NOT NULL,reset_at INTEGER NOT NULL);`);return connection;}
export type AccountUser={id:string;email:string;profileState:ProfileState|null};
function publicUser(row:Record<string,unknown>):AccountUser{return {id:String(row.id),email:String(row.email),profileState:row.profile_json?JSON.parse(String(row.profile_json)):null};}
const digest=(token:string)=>createHash('sha256').update(token).digest('hex');
export class AccountError extends Error{constructor(message:string,public status=400){super(message);}}
function credentials(email:unknown,password:unknown){if(typeof email!=='string'||email.length>254||!/^\S+@\S+\.\S+$/.test(email)||typeof password!=='string'||password.length<10||password.length>128)throw new AccountError('请输入有效邮箱和 10–128 位密码');return {email:email.trim().toLowerCase(),password};}
export async function registerAccount(email:unknown,password:unknown){const c=credentials(email,password);const salt=randomBytes(16).toString('hex'),key=await derive(c.password,salt,64) as Buffer;
 try{const id=randomUUID();db().prepare('INSERT INTO users(id,email,password_hash,created_at) VALUES(?,?,?,?)').run(id,c.email,`${salt}:${key.toString('hex')}`,Date.now());return {id,email:c.email,profileState:null} as AccountUser;}
 catch(error){if(String(error).includes('UNIQUE'))throw new AccountError('该邮箱已注册，请直接登录');throw error;}}
export async function loginAccount(email:unknown,password:unknown){const c=credentials(email,password);const key=digest(c.email),now=Date.now();const limit=db().prepare('SELECT * FROM login_limits WHERE key=?').get(key);
 if(limit&&Number(limit.reset_at)>now&&Number(limit.attempts)>=8)throw new AccountError('尝试次数过多，请 5 分钟后重试',429);
 db().prepare('INSERT INTO login_limits(key,attempts,reset_at) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET attempts=CASE WHEN reset_at<? THEN 1 ELSE attempts+1 END,reset_at=CASE WHEN reset_at<? THEN ? ELSE reset_at END').run(key,now+300000,now,now,now+300000);
 const row=db().prepare('SELECT * FROM users WHERE email=?').get(c.email);const [salt,hex]=String(row?.password_hash??'missing:00').split(':');const actual=await derive(c.password,salt,64) as Buffer;const expected=Buffer.from(hex,'hex');
 if(!row||actual.length!==expected.length||!timingSafeEqual(actual,expected))throw new AccountError('邮箱或密码不正确',401);
 db().prepare('DELETE FROM login_limits WHERE key=?').run(key);return publicUser(row);}
export function createSession(userId:string){const token=randomBytes(32).toString('hex');db().prepare('DELETE FROM sessions WHERE expires_at<?').run(Date.now());db().prepare('INSERT INTO sessions VALUES(?,?,?)').run(digest(token),userId,Date.now()+604800000);return token;}
export function sessionToken(req:Request){return (req.headers.get('cookie')??'').split(';').map(s=>s.trim()).find(s=>s.startsWith('courseplan_session='))?.slice('courseplan_session='.length)??'';}
export function sessionUser(req:Request){const token=sessionToken(req);if(!/^[a-f0-9]{64}$/.test(token))return null;const row=db().prepare('SELECT u.* FROM users u JOIN sessions s ON s.user_id=u.id WHERE s.token_hash=? AND s.expires_at>?').get(digest(token),Date.now());return row?publicUser(row):null;}
export function endSession(req:Request){const token=sessionToken(req);if(token)db().prepare('DELETE FROM sessions WHERE token_hash=?').run(digest(token));}
export function saveProfile(userId:string,state:ProfileState){db().prepare('UPDATE users SET profile_json=? WHERE id=?').run(JSON.stringify(state),userId);}
export function readWorkspace(userId:string,programId:string){const row=db().prepare('SELECT payload,updated_at FROM workspaces WHERE user_id=? AND program_id=?').get(userId,programId);return row?{workspace:JSON.parse(String(row.payload)),updatedAt:Number(row.updated_at)}:{workspace:null,updatedAt:null};}
export function writeWorkspace(userId:string,programId:string,workspace:unknown){const now=Date.now();db().prepare('INSERT INTO workspaces VALUES(?,?,?,?) ON CONFLICT(user_id,program_id) DO UPDATE SET payload=excluded.payload,updated_at=excluded.updated_at').run(userId,programId,JSON.stringify(workspace),now);return now;}
export function assertSameOrigin(req:Request){const origin=req.headers.get('origin');if(!origin||new URL(origin).host!==req.headers.get('host'))throw new AccountError('请求来源不受支持',403);if(!req.headers.get('content-type')?.includes('application/json'))throw new AccountError('请使用 JSON 请求',415);}
export async function readJSON(req:Request,max=15000){const raw=await req.text();if(raw.length>max)throw new AccountError('请求内容过大',413);try{return JSON.parse(raw) as Record<string,unknown>;}catch{throw new AccountError('JSON 格式不正确');}}
