import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import * as raw from "../../data/courses";
const baseCourses: any[] = (raw as any).courses ?? (raw as any).default ?? [];

const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "llama3.2:1b";
const OLLAMA_URL = process.env.OLLAMA_URL || "http://127.0.0.1:11434/api/generate";
const OLLAMA_TIMEOUT_MS = 90000;

type LocalCourse = {
  code: string;
  title: string;
  summary?: string;
  faculty?: string;
  cp?: number;
  year?: string;
  skills?: string[];
  opportunities?: string[];
};

type RecItem = {
  course_id: string;
  title: string;
  match: number;
  why: string;
  faculty?: string | null;
  cp?: number | null;
  year?: string | null;
  skills?: string[];
  opportunities?: string[];
  description?: string | null;
};

// ---------- Utility Functions ----------
function normalizeCourse(input: any): LocalCourse | null {
  if (!input) return null;
  const code = String(input.code ?? input.id ?? input.course_id ?? "").trim();
  const title = String(input.title ?? input.name ?? "").trim();
  if (!code || !title) return null;
  const cpRaw = input.cp ?? input.credits ?? input.creditPoints;
  return {
    code,
    title,
    summary: input.summary ?? input.description ?? undefined,
    faculty: input.faculty ?? input.school ?? undefined,
    cp: typeof cpRaw === "number" ? cpRaw : undefined,
    year: input.year ?? input.level ?? undefined,
    skills: Array.isArray(input.skills) ? input.skills : undefined,
    opportunities: Array.isArray(input.opportunities) ? input.opportunities : undefined,
  };
}

function rankByKeyword(list: LocalCourse[], interest: string): RecItem[] {
  const q = interest.toLowerCase();
  return list
    .map((c) => {
      const hay = [
        c.title ?? "",
        c.summary ?? "",
        ...(c.skills ?? []),
        ...(c.opportunities ?? []),
      ].join(" ").toLowerCase();
      let score = 0;
      if (hay.includes(q)) score += 0.6;
      for (const tk of q.split(/\s+/).filter(Boolean)) {
        if (hay.includes(tk)) score += 0.1;
      }
      score = Math.min(1, Math.max(0, score));
      const match = Math.round(score * 100);
      return {
        course_id: c.code,
        title: c.title,
        match,
        why: c.summary ?? `This course relates to your interest in ${interest}.`,
        faculty: c.faculty ?? null,
        cp: c.cp ?? null,
        year: c.year ?? null,
        skills: c.skills ?? [],
        opportunities: c.opportunities ?? [],
        description: c.summary ?? null,
      } as RecItem;
    })
    .sort((a, b) => b.match - a.match);
}

function extractJsonEnhanced(text: string): any | null {
  try { return JSON.parse(text); } catch { }
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try { return JSON.parse(m[0]); } catch { return null; }
}

function postprocessItems(raw: any[], topk: number, interest: string, candidates: LocalCourse[]): RecItem[] {
  const catalogMap = new Map(candidates.map((c) => [String(c.code), c]));

  function keywordScore(text: string) {
    const t = (text || "").toLowerCase();
    if (!t) return 20;
    let s = 0;
    if (t.includes(interest.toLowerCase())) s += 60;
    for (const tk of interest.toLowerCase().split(/\s+/).filter(Boolean)) {
      if (t.includes(tk)) s += 10;
    }
    return Math.max(25, Math.min(95, s));
  }

  const cleaned = raw
    .map((r) => {
      const id = String(r.course_id ?? r.code ?? "");
      const title = String(r.title ?? "");
      const cat = catalogMap.get(id);
      const baseText = [title, cat?.summary].filter(Boolean).join(" ");

      let match = Number.isFinite(+r.match) ? Number(r.match) : 0;
      if (match <= 0 || match > 100) match = keywordScore(baseText);

      let why = String(r.why ?? "").trim();
      if (!why) {
        const s = (cat?.summary || title || "").slice(0, 120);
        why = s
          ? `Matches your interest "${interest}". ${s}`
          : `Matches your interest "${interest}".`;
      }

      return {
        course_id: id,
        title,
        match: Math.round(match),
        why,
        faculty: (r.faculty ?? cat?.faculty ?? null) as string | null,
        cp: typeof r.cp === "number" ? r.cp : (cat?.cp ?? null),
        year: (r.year ?? cat?.year ?? null) as string | null,
        skills: Array.isArray(r.skills) ? r.skills : (cat?.skills ?? []),
        opportunities: Array.isArray(r.opportunities)
          ? r.opportunities
          : (cat?.opportunities ?? []),
        description: (r.description ?? cat?.summary ?? null) as string | null,
      } as RecItem;
    })
    .filter((x) => x.course_id && x.title);

  cleaned.sort((a, b) => b.match - a.match);
  return cleaned.slice(0, topk);
}

// ---------- Main Body ----------
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const interest = String(body?.interest_text ?? body?.query ?? "").trim();
    const topk = Number(body?.topk ?? 4);
    if (!interest) return NextResponse.json({ error: "missing interest_text" }, { status: 400 });

    const inputCourses: any[] = Array.isArray(body?.courses) && body.courses.length > 0 ? body.courses : baseCourses;
    const normalized = (inputCourses.map(normalizeCourse).filter(Boolean) as LocalCourse[]).slice(0, 10);

    const prompt = `
You are a helpful university course advisor. Read student's interest and suggest relevant courses.
Always respond in valid JSON. 
Rules:
- "items" must contain 3–5 course objects.
- Each object must include: course_id, title, match (1–100), and a clear "why" reason (short English).
- "match" reflects similarity to the interest topic.
- If unsure, infer a likely reason from the title or summary.
Student interest: ${interest}
Course catalog (JSON):
${JSON.stringify(normalized, null, 2)}
Return ONLY valid JSON with the following schema:
{"items":[{"course_id":"string","title":"string","match":number,"why":"string"}]}
`.trim();

    let items: RecItem[] = [];
    let source: "llm" | "fallback" = "fallback";

    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), OLLAMA_TIMEOUT_MS);

      const resp = await fetch(OLLAMA_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: OLLAMA_MODEL,
          prompt,
          stream: false,
          format: "json",
        }),
        signal: ctrl.signal,
      });

      clearTimeout(timer);
      const data = await resp.json();
      const rawText = String(data?.response ?? "");
      if (rawText) console.log("LLM OK, bytes=", rawText.length);

      const parsed = extractJsonEnhanced(rawText);
      if (parsed && Array.isArray(parsed.items)) {
        items = postprocessItems(parsed.items, topk, interest, normalized);
        if (items.length > 0) source = "llm";
      }
    } catch (err) {
      console.warn("⚠️ LLM call failed, using fallback:", err);
    }

    if (items.length === 0) {
      items = rankByKeyword(normalized, interest).slice(0, topk);
      source = "fallback";
    }

    return NextResponse.json({ source, items });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "internal_error" }, { status: 500 });
  }
}
