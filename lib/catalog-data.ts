import computing from '../app/data/catalog/subjects.json';
import additional from '../app/data/catalog/program-subjects.json';
import {getProgram} from './programs';
import type {CatalogCourse} from './planning';
export function catalogForProgram(id:string):CatalogCourse[]{const program=getProgram(id);return [...computing,...additional].filter(c=>c.dataset_id===program.datasetId) as CatalogCourse[];}
