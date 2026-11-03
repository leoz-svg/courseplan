import type {CatalogCourse} from './planning';
/** The reviewed local snapshot is authoritative; an older remote subset must never shrink it. */
export function mergeCatalogSnapshot(snapshot:CatalogCourse[],remote:CatalogCourse[]):CatalogCourse[]{
 const known=new Map(remote.map(c=>[c.code,c]));
 return snapshot.map(c=>({...known.get(c.code),...c}));
}
