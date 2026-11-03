import {spawnSync} from 'node:child_process';
import path from 'node:path';
const python=process.env.COURSEPLAN_PLANNER_PYTHON||path.join(process.cwd(),'.planner-venv',process.platform==='win32'?'Scripts/python.exe':'bin/python');
const result=spawnSync(python,['-m','unittest','discover','-s','scripts/pathways','-p','test_*.py'],{stdio:'inherit',windowsHide:true});
if(result.error)console.error('Python planner environment unavailable. See scripts/pathways/README.md.');
process.exit(result.status??1);
