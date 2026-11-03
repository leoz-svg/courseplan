import { getActivePlan } from "./storage";
import { courses } from "../app/data/courses";

/** GitHub Pages has no model server. This explicitly labelled demo ranks real
 * catalog entries locally; it never pretends to produce LLM output. */
export function demoRecommendations(query: string, topk = 6) {
  const tokens = query.toLowerCase().match(/[a-z0-9]+/g) ?? [];
  const stop = new Set(["i", "m", "am", "in", "and", "the", "to", "about", "want", "learn", "interested", "would", "like"]);
  const terms = tokens.filter(t => !stop.has(t));
  const aliases: Record<string, string[]> = {
    "数据": ["data", "analytics"], "编程": ["programming", "software"],
    "人工智能": ["artificial", "intelligence", "machine"], "网络": ["network", "web"],
    "商业": ["business", "management"], "设计": ["design"]
  };
  Object.entries(aliases).forEach(([key, values]) => { if (query.includes(key)) terms.push(...values); });
  const program = getActivePlan()?.profile.program;
  const eligible = courses.filter(c => !program || c.program === program || c.program === "All Programs");
  const unique = [...new Map(eligible.map(c => [c.code, c])).values()];
  return unique.map(c => {
    const hay = `${c.name} ${c.faculty} ${c.program}`.toLowerCase();
    const hits = terms.filter(t => hay.includes(t));
    return { course_id: c.code, title: c.name, match: Math.round(100 * hits.length / Math.max(1, terms.length)),
      why: `Keyword demo: matches ${[...new Set(hits)].join(", ")}. No language model was called.`,
      faculty: c.faculty, cp: c.credits, year: c.level, skills: [], opportunities: [], hits: hits.length };
  }).filter(c => c.hits > 0).sort((a,b) => b.hits-a.hits).slice(0,topk);
}
