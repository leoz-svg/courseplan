'use client';

import { ExternalLink, ChevronRight, Zap } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Course } from './types';
import { getActivePlan, upsertPlan } from '../../lib/storage';

export default function CourseDetails({ course, all }: { course?: Course; all: Course[] }) {
    const [isCompleted, setIsCompleted] = useState(false);

    // derive initial completed state from active plan (fallback localStorage)
    useEffect(() => {
        if (!course) {
            setIsCompleted(false);
            return;
        }
        try {
            const plan = getActivePlan();
            if (plan) {
                const set = new Set((plan.completedCodes || []).map(String));
                setIsCompleted(set.has(String(course.code)));
                return;
            }
            const raw = localStorage.getItem('completed-courses');
            const arr: string[] = raw ? JSON.parse(raw) : [];
            setIsCompleted(new Set(arr.map(String)).has(String(course.code)));
        } catch {
            setIsCompleted(false);
        }
    }, [course]);

    if (!course) {
        return <div className="text-slate-400 p-4">Select a course node to see details.</div>;
    }

    // cache to narrow type for TS
    const courseCode = String(course.code);
    const courseName = course.name;

    const manualUrl = `https://handbook.uts.edu.au/subjects/${courseCode}.html`;

    const prereq = (course.prerequisites ?? []).map(code => {
        const found = all.find(c => String(c.code).trim() === String(code).trim());
        return { code: String(code), name: found?.name };
    });

    // Unlocks: other courses that have this course as prerequisite
    const unlocks = (() => {
        const raw = all
            .filter(c => (c.prerequisites ?? []).map(String).map(s => s.trim()).includes(String(course.code).trim()))
            .map(c => ({ code: String(c.code), name: c.name }));
        // Deduplicate: unique by code
        const map = new Map<string, { code: string; name?: string }>();
        raw.forEach(u => {
            if (!map.has(u.code)) map.set(u.code, u);
        });
        return Array.from(map.values());
    })();

    function toggleCompleted() {
        try {
            const plan = getActivePlan();
            if (plan) {
                const beforeHas = (plan.completedCodes || []).includes(courseCode);
                const next = beforeHas
                    ? (plan.completedCodes || []).filter(c => c !== courseCode)
                    : [...(plan.completedCodes || []), courseCode];
                plan.completedCodes = next;
                // log activity
                const message = beforeHas
                    ? `Unmarked ${courseCode} ${courseName} as completed`
                    : `Marked ${courseCode} ${courseName} as completed`;
                const act = { id: `${Date.now()}-${courseCode}`, message, ts: Date.now() } as any;
                plan.activity = Array.isArray((plan as any).activity) ? [act, ...((plan as any).activity as any[])] : [act];
                plan.updatedAt = Date.now();
                upsertPlan(plan);
                setIsCompleted(!beforeHas);
                // broadcast change so Dashboard/UserInfo update immediately
                window.dispatchEvent(new CustomEvent('plan-changed'));
            } else {
                // fallback local storage (no plan) – keep SPA
                const arr: string[] = JSON.parse(localStorage.getItem('completed-courses') || '[]');
                const has = arr.includes(courseCode);
                const next = has ? arr.filter(c => c !== courseCode) : [...arr, courseCode];
                localStorage.setItem('completed-courses', JSON.stringify(next));
                setIsCompleted(!has);
            }
        } catch {
            // ignore
        }
    }

    return (
        <div className="space-y-5">
            {/* Title + external link */}
            <div className="flex items-start justify-between gap-3">
                <div>
                    <div className="text-2xl font-bold text-white tracking-tight">{course.code}</div>
                    <div className="text-slate-300 mt-1 leading-snug">{course.name}</div>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={toggleCompleted}
                        className={`px-3 h-8 rounded-lg text-sm font-medium ${isCompleted ? 'bg-emerald-600 text-white' : 'bg-slate-700 text-white hover:bg-slate-600'}`}
                    >
                        {isCompleted ? 'Completed' : 'Mark as Completed'}
                    </button>
                    <a href={manualUrl} target="_blank" className="inline-flex items-center gap-1 text-slate-300 hover:text-white">
                        <ExternalLink className="w-4 h-4" />
                    </a>
                </div>
            </div>

            {/* Badges */}
            <div className="flex flex-wrap items-center gap-2">
                {course.faculty && (
                    <span className="inline-flex px-2.5 py-1 rounded-full bg-emerald-900/50 text-emerald-200 border border-emerald-700">
                        {course.faculty}
                    </span>
                )}
                {course.level && (
                    <span className="inline-flex px-2.5 py-1 rounded-full bg-slate-700/60 text-slate-200 border border-slate-600">
                        {String(course.level).toLowerCase()}
                    </span>
                )}
                {typeof course.credits === 'number' && (
                    <span className="inline-flex px-2.5 py-1 rounded-full bg-blue-900/40 text-blue-200 border border-blue-700">
                        {course.credits} CP
                    </span>
                )}
            </div>

            {/* Description */}
            {course.description && (
                <div>
                    <div className="font-semibold text-white">Description</div>
                    <p className="mt-1 text-slate-300 text-sm leading-relaxed">{course.description}</p>
                </div>
            )}

            {/* Unlocks */}
            <div>
                <div className="flex items-center gap-2 font-semibold text-white">
                    <Zap className="w-4 h-4 text-emerald-300" />
                    <span>Unlocks</span>
                </div>
                {unlocks.length === 0 ? (
                    <div className="text-slate-400 text-sm mt-2">No direct unlocks.</div>
                ) : (
                    <div className="mt-2 space-y-2">
                        {unlocks.map((u, idx) => (
                            <div key={`${u.code}-${idx}`} className="rounded-lg bg-emerald-900/50 border border-emerald-700 text-emerald-100 px-3 py-2">
                                <div className="font-medium">{u.code}: {u.name}</div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Prerequisites */}
            <div>
                <div className="flex items-center gap-2 font-semibold text-white">
                    <ChevronRight className="w-4 h-4 text-rose-300" />
                    <span>Prerequisites</span>
                </div>
                {prereq.length === 0 ? (
                    <div className="text-slate-400 text-sm mt-2">None</div>
                ) : (
                    <div className="mt-2 space-y-2">
                        {prereq.map(p => (
                            <div key={p.code} className="rounded-lg bg-rose-900/60 border border-rose-800 text-rose-100 px-3 py-2">
                                <div className="font-medium">
                                    {p.code}{p.name ? `: ${p.name}` : ''}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}




