import introductions from '../data/catalog/introductions.json';
import {ArrowUpRight} from 'lucide-react';
export default function CourseIntroduction({code,compact=false}:{code:string;compact?:boolean}){
 const introduction=introductions.find(item=>item.code===code);
 if(!introduction)return null;
 return <div className={`course-introduction${compact?' compact':''}`}><span className="intro-label">简介</span><p>{introduction.summary_zh||introduction.summary_en}</p><a href={introduction.source_url} target="_blank" rel="noreferrer">UTS Handbook {introduction.source_year} · {introduction.summary_kind==='official_description_excerpt'?'官方原文节选':'中文摘要'}<ArrowUpRight size={11}/></a></div>;
}
