import {cp,mkdir,rm,symlink,writeFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
const root=process.cwd(),stage=path.resolve(root,'.pages-build');
if(path.dirname(stage)!==path.resolve(root)||path.basename(stage)!=='.pages-build')throw new Error('Invalid staging path');
if(existsSync(stage))await rm(stage,{recursive:true,force:true});
await mkdir(stage,{recursive:true});
for(const entry of ['app','lib','public','next.config.ts','package.json','package-lock.json','tsconfig.json','next-env.d.ts','postcss.config.mjs','tailwind.config.js']){
 if(!existsSync(path.join(root,entry)))continue;
 await cp(path.join(root,entry),path.join(stage,entry),{recursive:true,filter:source=>!path.relative(root,source).replaceAll('\\','/').startsWith('app/api')});
}
await symlink(path.join(root,'node_modules'),path.join(stage,'node_modules'),process.platform==='win32'?'junction':'dir');
const build=spawnSync(process.execPath,[path.join(root,'node_modules/next/dist/bin/next'),'build','--no-lint'],{cwd:stage,stdio:'inherit',windowsHide:true,env:{...process.env,NEXT_PUBLIC_DEMO_MODE:'1',NEXT_PUBLIC_BASE_PATH:process.env.NEXT_PUBLIC_BASE_PATH||'/courseplan'}});
if(build.status!==0)throw new Error('Static demo build failed');
await writeFile(path.join(stage,'out','.nojekyll'),'');
console.log('Static demo output: .pages-build/out (original app/api left intact).');
