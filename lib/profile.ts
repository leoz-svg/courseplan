import {getProgram,type ProgramId} from './programs.ts';
export type LearningProfile={programId:ProgramId;displayName:string;studentId:string;entryYear:number;targetCredits:number;priorCredits:number};
export type ProfileState={activeProgramId:ProgramId;profiles:Partial<Record<ProgramId,LearningProfile>>};
export type Identity={id:string;kind:'guest'|'account';email?:string};
export function validateProfile(value:unknown):LearningProfile{
 if(!value||typeof value!=='object')throw new Error('请填写学习档案');const p=value as LearningProfile;const program=getProgram(p.programId);
 if(typeof p.displayName!=='string'||!p.displayName.trim()||p.displayName.trim().length>60)throw new Error('称呼需为 1–60 字');
 if(typeof p.studentId!=='string'||p.studentId.length>32||!/^[-\p{L}\p{N} ]*$/u.test(p.studentId))throw new Error('学号限 32 位字母、数字、空格或连字符');
 if(!Number.isInteger(p.entryYear)||p.entryYear<2000||p.entryYear>2100)throw new Error('入学年份需在 2000–2100 之间');
 if(!Number.isInteger(p.targetCredits)||p.targetCredits<1||p.targetCredits>600)throw new Error('目标学分需为 1–600 的整数');
 if(!Number.isInteger(p.priorCredits)||p.priorCredits<0||p.priorCredits>p.targetCredits)throw new Error('认可学分需在 0 与目标学分之间');
 return {...p,programId:program.id,displayName:p.displayName.trim(),studentId:p.studentId.trim()};
}
export function validateProfileState(value:unknown):ProfileState{
 if(!value||typeof value!=='object')throw new Error('学习档案格式不正确');const s=value as ProfileState;getProgram(s.activeProgramId);
 if(!s.profiles||typeof s.profiles!=='object'||Array.isArray(s.profiles))throw new Error('学习档案格式不正确');
 const profiles:ProfileState['profiles']={};for(const [id,p] of Object.entries(s.profiles)){const valid=validateProfile(p);if(valid.programId!==id)throw new Error('Program 与学习档案不匹配');profiles[valid.programId]=valid;}
 if(!profiles[s.activeProgramId])throw new Error('缺少当前 Program 档案');return {activeProgramId:s.activeProgramId,profiles};
}
export function creditProgress(target:number,prior:number,completed:number,planned:number){
 const achieved=prior+completed;return {achieved,planned,remaining:Math.max(0,target-achieved),unallocated:Math.max(0,target-achieved-planned),completedPercent:Math.min(100,achieved/target*100),plannedPercent:Math.min(Math.max(0,100-achieved/target*100),planned/target*100),overTarget:Math.max(0,achieved+planned-target)};
}
