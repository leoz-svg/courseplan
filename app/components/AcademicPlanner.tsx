'use client';

import { useMemo, useState, useEffect } from 'react';
import {
    DndContext, DragOverlay, PointerSensor, useSensor, useSensors,
    closestCenter, useDroppable,
} from '@dnd-kit/core';
import {
    SortableContext, arrayMove, rectSortingStrategy, useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { snapCenterToCursor } from '@dnd-kit/modifiers';
import { nanoid } from 'nanoid';
import { getActivePlan, upsertPlan } from '../../lib/storage';
import { Search, Download, Share2, AlertTriangle, CheckCircle2, CalendarDays } from 'lucide-react';
import { Course } from './types';

/* ========== Types ========== */
type TermId = string;
type PlannerTerm = {
    id: TermId;
    title: string;
    limitCP: number;
    courseIds: number[];
};
type PlannerState = { terms: PlannerTerm[] };

/* ========== Small Cards (shared by Catalog + Term) ========== */
function CourseCardMini({ course, dragging }: { course: Course; dragging?: boolean }) {
    return (
        <div
            className={`rounded-xl border bg-white text-slate-800 p-3 shadow-sm flex items-center justify-between gap-3
        ${dragging ? 'opacity-90 shadow-lg' : ''} cursor-move select-none touch-none`}
        >
            <div className="min-w-0">
                <div className="font-semibold truncate">{course.code}</div>
                <div className="text-slate-500 text-sm truncate">{course.name}</div>
            </div>
            {typeof course.credits === 'number' && (
                <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                    {course.credits} CP
                </span>
            )}
        </div>
    );
}

/* ========== Sortable item ========== */
function SortableCourseItem({ course }: { course: Course }) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
        useSortable({ id: course.id });
    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 50 : undefined,
    };
    return (
        <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
            <CourseCardMini course={course} dragging={isDragging} />
        </div>
    );
}

/* ========== Left Side Catalog (this is droppable: id='catalog') ========== */
function CatalogSidebar({
    catalog, onSearch, keyword, programFilter, onProgramFilter,
}: {
    catalog: Course[];
    keyword: string;
    onSearch: (s: string) => void;
    programFilter: string;
    onProgramFilter: (p: string) => void;
}) {
    const { setNodeRef, isOver } = useDroppable({ id: 'catalog' });

    return (
        <aside className="w-full lg:w-72 xl:w-80 shrink-0">
            <div className="rounded-2xl bg-white border border-slate-200 shadow-sm">
                <div className="px-4 py-3 border-b bg-gradient-to-r from-indigo-500 to-blue-600 text-white rounded-t-2xl flex items-center justify-between">
                    <div className="text-lg font-semibold">Course Catalog ({catalog.length})</div>
                </div>
                <div className="p-4 border-b">
                    <div className="relative">
                        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                            value={keyword}
                            onChange={(e) => onSearch(e.target.value)}
                            placeholder="Search..."
                            className="pl-9 w-full h-10 rounded-xl border border-slate-300 bg-white text-slate-800 placeholder:text-slate-500  /* ← Real text & placeholder darkened */
                                      focus:ring-2 focus:ring-indigo-300 focus:border-indigo-300
                                      caret-indigo-600"
                        />
                    </div>
                    <div className="mt-3">
                        <select
                            value={programFilter}
                            onChange={(e) => onProgramFilter(e.target.value)}
                            className="w-full h-10 rounded-xl border border-slate-300 bg-white text-slate-800 px-3"
                        >
                            <option value="All">All Programs Courses</option>
                            <option value="Bachelor of Engineering (Software)">Bachelor of Engineering (Software)</option>
                            <option value="Bachelor of Information Technology">Bachelor of Information Technology</option>
                            <option value="Bachelor of Science (Data Science)">Bachelor of Science (Data Science)</option>
                            <option value="All Programs">All Programs Can Select</option>
                        </select>
                    </div>
                </div>
                <div className="p-4">
                    {/* droppable container - changed to scrollable dropdown form */}
                    <div ref={setNodeRef} className={isOver ? 'ring-2 ring-indigo-200 rounded-xl p-1 -m-1' : ''}>
                        <SortableContext items={catalog.map(c => c.id)} strategy={rectSortingStrategy}>
                            <div className="max-h-96 overflow-y-auto space-y-2 border border-slate-200 rounded-lg p-2">
                                {catalog.map(c => <SortableCourseItem key={c.id} course={c} />)}
                                {!catalog.length && <div className="text-slate-400 text-sm p-2">No results.</div>}
                            </div>
                        </SortableContext>
                    </div>
                </div>
            </div>
        </aside>
    );
}

/* ========== Right Side Term Columns (empty area droppable: id=term.id) ========== */
function TermColumn({
    term, coursesById, overCP,
}: {
    term: PlannerTerm;
    coursesById: Map<number, Course>;
    overCP: boolean;
}) {
    const totalCP = term.courseIds.reduce((acc, id) => acc + (coursesById.get(id)?.credits ?? 0), 0);
    const list = term.courseIds.map(id => coursesById.get(id)!).filter(Boolean);
    const { setNodeRef, isOver } = useDroppable({ id: term.id });

    return (
        <div className={`rounded-2xl border bg-white shadow-sm ${overCP ? 'border-rose-300' : 'border-slate-200'}`}>
            <div className="px-4 py-3 border-b bg-indigo-600 text-white rounded-t-2xl flex items-center justify-between">
                <div className="font-semibold">{term.title}</div>
                <div className="text-sm font-semibold px-2 py-1 rounded-full bg-white/20">
                    {totalCP} CP
                </div>
            </div>

            <div className="p-3">
                <SortableContext items={list.map(c => c.id)} strategy={rectSortingStrategy}>
                    <div ref={setNodeRef} className={`space-y-2 min-h-[120px] ${isOver ? 'ring-2 ring-indigo-200 rounded-xl p-2 -m-2' : ''}`}>
                        {list.map(c => <SortableCourseItem key={c.id} course={c} />)}
                        {!list.length && (
                            <div className="rounded-xl border border-dashed border-slate-300 text-slate-400 text-sm p-6 text-center">
                                Drag courses here
                            </div>
                        )}
                    </div>
                </SortableContext>
            </div>
            {/* removed inline over-limit text per requirement */}
        </div>
    );
}

/* ========== Main Component ========== */
export default function AcademicPlanner({ courses = [] as Course[] }) {
    // Initial example terms
    const initial: PlannerState = {
        terms: [],
    };

    const [state, setState] = useState<PlannerState>(() => {
        if (typeof window !== 'undefined') {
            const plan = getActivePlan();
            if (plan?.planner && (plan.planner as any).terms?.length) return plan.planner as PlannerState;
            const year = String(plan?.profile?.entryYear || '2024');
            return {
                terms: [
                    { id: nanoid(), title: `${year} Autumn`, limitCP: 24, courseIds: [] },
                    { id: nanoid(), title: `${year} Spring`, limitCP: 24, courseIds: [] },
                ],
            };
        }
        return initial;
    });

    const [activePlan, setActivePlan] = useState<any>(null);
    const [warnings, setWarnings] = useState<string[]>([]);
    const pushWarning = (msg: string) => setWarnings([msg]); // 只保留最新的一次警告

    // 清除所有警告
    const clearWarnings = () => setWarnings([]);

    // Load active plan information
    useEffect(() => {
        const loadActivePlan = () => {
            if (typeof window !== 'undefined') {
                const plan = getActivePlan();
                setActivePlan(plan);
                // Automatically set filter based on active plan's program
                if (plan?.profile?.program) {
                    setProgramFilter(plan.profile.program);
                }
                // Sync default two terms' year to entry year (only when currently two terms and both in default mode)
                if (plan?.profile?.entryYear) {
                    setState(prev => {
                        if (prev.terms.length === 2) {
                            const y = String(plan.profile.entryYear);
                            const t0 = { ...prev.terms[0], title: `${y} Autumn` };
                            const t1 = { ...prev.terms[1], title: `${y} Spring` };
                            return { terms: [t0, t1] };
                        }
                        return prev;
                    });
                }
            }
        };

        loadActivePlan();

        // Listen for plan change events
        const handlePlanChange = () => loadActivePlan();
        window.addEventListener('plan-changed', handlePlanChange as any);

        return () => window.removeEventListener('plan-changed', handlePlanChange as any);
    }, []);

    useEffect(() => {
        if (typeof window !== 'undefined') {
            const plan = getActivePlan();
            if (plan) {
                plan.planner = state;
                plan.updatedAt = Date.now();
                upsertPlan(plan);
            } else {
                localStorage.setItem('planner-state', JSON.stringify(state));
            }
        }

        // 检测初始状态下的课程数量警告
        state.terms.forEach(term => {
            if (term.courseIds.length > 4) {
                pushWarning(`Course count warning: ${term.title} has ${term.courseIds.length} courses (recommended max: 4).`);
            }
        });
    }, [state]);

    const [keyword, setKeyword] = useState('');
    const [programFilter, setProgramFilter] = useState('All');

    const coursesById = useMemo(() => new Map(courses.map(c => [c.id, c])), [courses]);
    const totalPlannedCP = useMemo(() => {
        return state.terms.reduce((sum, t) => sum + t.courseIds.reduce((acc, id) => acc + (coursesById.get(id)?.credits ?? 0), 0), 0);
    }, [state.terms, coursesById]);

    // Catalog = courses not placed in any term + search + program filtering
    const usedIds = new Set(state.terms.flatMap(t => t.courseIds));
    const catalog = useMemo(() => {
        const q = keyword.trim().toLowerCase();

        const filtered = courses
            .filter(c => !usedIds.has(c.id)) // Exclude already used courses
            .filter(c => {
                // Search filtering - consistent with Course Explorer
                const matchText = `${c.code} ${c.name} ${c.faculty} ${c.level ?? ''}`.toLowerCase();
                const matchSearch = !q || matchText.includes(q);

                // Program filtering - consistent with Course Explorer
                const matchProgram = programFilter === 'All' ||
                    String((c as any).program) === programFilter ||
                    (programFilter === 'All Programs' && String((c as any).program) === 'All Programs');

                return matchSearch && matchProgram;
            });

        // Debug information
        console.log('Academic Planner Filter Debug:');
        console.log('- Program filter:', programFilter);
        console.log('- Total courses:', courses.length);
        console.log('- Used courses:', usedIds.size);
        console.log('- Available courses:', courses.filter(c => !usedIds.has(c.id)).length);
        console.log('- Filtered courses:', filtered.length);
        console.log('- Sample courses:', courses.slice(0, 3).map(c => ({ code: c.code, program: (c as any).program })));

        return filtered;
    }, [courses, usedIds, keyword, programFilter]);

    // Whether term exceeds credit hours
    const overMap = useMemo(() => {
        const map = new Map<TermId, boolean>();
        state.terms.forEach(t => {
            const cp = t.courseIds.reduce((acc, id) => acc + (coursesById.get(id)?.credits ?? 0), 0);
            map.set(t.id, cp > t.limitCP);
        });
        return map;
    }, [state.terms, coursesById]);

    // Prerequisites validation: course prerequisites must be "completed or in earlier terms"
    function getCompletedCodes(): Set<string> {
        try {
            const raw = localStorage.getItem('completed-courses');
            const arr: string[] = raw ? JSON.parse(raw) : [];
            return new Set(arr.map(String));
        } catch {
            return new Set();
        }
    }

    const completedSet = getCompletedCodes();

    function termPrerequisiteWarnings(term: PlannerTerm): { courseId: number; missing: string[] }[] {
        const warnings: { courseId: number; missing: string[] }[] = [];
        const plannedCodesBefore: Set<string> = new Set();
        // Assume terms order represents chronological order
        for (const t of state.terms) {
            if (t.id === term.id) break;
            t.courseIds.forEach(id => {
                const c = coursesById.get(id);
                if (c) plannedCodesBefore.add(String(c.code));
            });
        }
        const available = new Set<string>([...completedSet, ...plannedCodesBefore]);
        term.courseIds.forEach(id => {
            const c = coursesById.get(id);
            if (!c) return;
            const prereq = (c.prerequisites ?? []).map(s => String(s).trim());
            const missing = prereq.filter(code => !available.has(code));
            if (missing.length) warnings.push({ courseId: id, missing });
        });
        return warnings;
    }

    // DnD
    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
    const [activeId, setActiveId] = useState<number | null>(null);

    const findContainer = (courseId: number): TermId | 'catalog' => {
        for (const t of state.terms) if (t.courseIds.includes(courseId)) return t.id;
        return 'catalog';
    };

    function onDragStart(event: any) {
        const id: number = event.active?.id;
        if (id == null) return;
        setActiveId(id);
    }

    function onDragEnd(event: any) {
        const activeId: number = event.active?.id;
        const over = event.over;
        if (activeId == null || !over) { setActiveId(null); return; }

        const overId = over.id as number | string;
        const from = findContainer(activeId);
        let to: TermId | 'catalog';

        // Target container parsing: if dropped on course item → get its container; if dropped on empty area → over.id is the container id
        if (typeof overId === 'number') to = findContainer(overId);
        else to = overId as any;

        if (from === to) {
            // Same container sorting (catalog does not sort)
            if (from !== 'catalog' && typeof overId === 'number') {
                const term = state.terms.find(t => t.id === from)!;
                const oldIdx = term.courseIds.indexOf(activeId);
                const overIdx = term.courseIds.indexOf(overId);
                if (oldIdx !== -1 && overIdx !== -1 && oldIdx !== overIdx) {
                    const next = arrayMove(term.courseIds, oldIdx, overIdx);
                    setState(s => ({ terms: s.terms.map(t => t.id === term.id ? { ...t, courseIds: next } : t) }));
                }
            }
        } else {
            // Cross-container movement
            let nextTerms = state.terms.map(t => ({ ...t, courseIds: [...t.courseIds] }));

            // Only perform constraint validation when adding from catalog to a term
            if (from === 'catalog' && to !== 'catalog') {
                const dst = nextTerms.find(t => t.id === to)!;
                const course = coursesById.get(activeId);
                const normalize = (s: any) => String(s ?? '').trim().toLowerCase();

                // 1) Program validation: only allow current program or All Programs
                try {
                    const plan = getActivePlan();
                    const planProgram = normalize(plan?.profile?.program);
                    const courseProgram = normalize((course as any)?.program);
                    if (planProgram && courseProgram && courseProgram !== planProgram && courseProgram !== normalize('All Programs')) {
                        pushWarning('Not allowed: this course belongs to a different program.');
                        setActiveId(null);
                        return;
                    }
                } catch { }

                // 2) Prerequisites validation: must be completed or in earlier terms
                const plannedCodesBefore: Set<string> = new Set();
                for (const t of nextTerms) {
                    if (t.id === dst.id) break;
                    t.courseIds.forEach(id => {
                        const c = coursesById.get(id);
                        if (c) plannedCodesBefore.add(String(c.code));
                    });
                }
                const available = new Set<string>([...completedSet, ...plannedCodesBefore]);
                const prereq = (course?.prerequisites ?? []).map((s: any) => String(s).trim());
                const missing = prereq.filter((code: string) => !available.has(code));
                if (missing.length) {
                    pushWarning(`Prerequisites not met for ${course?.code}. Need: ${missing.join(', ')}`);
                    setActiveId(null);
                    return;
                }

                // 3) Credit warning: warn if exceeds 24 CP but allow addition
                const currentCp = dst.courseIds.reduce((acc, id) => acc + (coursesById.get(id)?.credits ?? 0), 0);
                const newCp = currentCp + (course?.credits ?? 0);
                if (newCp > 24) {
                    pushWarning(`Load warning: ${(nextTerms.find(t => t.id === dst.id) as any)?.title} will reach ${newCp} CP (>24).`);
                }
            }

            // 1) Remove from source
            if (from !== 'catalog') {
                const src = nextTerms.find(t => t.id === from)!;
                src.courseIds = src.courseIds.filter(id => id !== activeId);

                // 当课程被拖回catalog时，清除所有警告
                if (to === 'catalog') {
                    clearWarnings();
                }
            }
            // 2) Insert into target
            if (to !== 'catalog') {
                const dst = nextTerms.find(t => t.id === to)!;
                let insertIdx = dst.courseIds.length;
                if (typeof overId === 'number') {
                    const idx = dst.courseIds.indexOf(overId);
                    if (idx >= 0) insertIdx = idx;
                }
                if (!dst.courseIds.includes(activeId)) dst.courseIds.splice(insertIdx, 0, activeId);
            }

            // Record activity: add/remove/move
            try {
                const plan = getActivePlan();
                const c = coursesById.get(activeId);
                const msgs: string[] = [];
                if (from !== 'catalog' && to === 'catalog') msgs.push(`Removed ${c?.code} from term`);
                if (from === 'catalog' && to !== 'catalog') msgs.push(`Added ${c?.code} to ${(nextTerms.find(t => t.id === to) as any)?.title}`);
                if (from !== 'catalog' && to !== 'catalog' && from !== to) msgs.push(`Moved ${c?.code} to ${(nextTerms.find(t => t.id === to) as any)?.title}`);
                if (plan && msgs.length) {
                    plan.activity = plan.activity || [];
                    msgs.forEach(m => plan.activity!.unshift({ id: String(Date.now()) + Math.random().toString(36).slice(2), ts: Date.now(), message: m }));
                    plan.activity = plan.activity.slice(0, 50);
                    plan.planner = { terms: nextTerms } as any;
                    plan.updatedAt = Date.now();
                    upsertPlan(plan);
                    window.dispatchEvent(new CustomEvent('plan-changed'));
                }
            } catch { }

            // Prerequisites real-time validation: if term has unmet prerequisites, still allow placement but highlight warning
            setState({ terms: nextTerms });

            // 检测课程数量警告：单个学期超过4门课
            nextTerms.forEach(term => {
                if (term.courseIds.length > 4) {
                    pushWarning(`Course count warning: ${term.title} has ${term.courseIds.length} courses (recommended max: 4).`);
                }
            });
        }

        setActiveId(null);
    }

    const activeCourse = activeId != null ? coursesById.get(activeId) : undefined;

    return (
        <div className="space-y-6">
            {/* Top title */}
            <header className="rounded-2xl bg-white border border-slate-200 shadow-sm p-6">
                <div className="flex items-center gap-3 text-3xl font-extrabold text-slate-900">
                    <span className="inline-flex w-10 h-10 rounded-xl bg-indigo-600/10 text-indigo-700 items-center justify-center border border-indigo-200">
                        <CalendarDays className="w-6 h-6" />
                    </span>
                    <span>Academic Planner</span>
                </div>
                <div className="text-slate-500">Drag, drop, and organize your degree pathway.</div>
                <div className="mt-4">
                    <div className="text-sm font-semibold text-slate-700 mb-2">Current Plan</div>
                    <div className="rounded-xl border border-slate-300 bg-slate-50 h-11 px-3 flex items-center text-slate-800">
                        {activePlan ? `${activePlan.name} (${activePlan.profile?.program || 'Unknown Program'})` : 'Loading...'}
                    </div>
                </div>
                <div className="mt-4 flex gap-2">
                    <button
                        onClick={() => {
                            const data = JSON.stringify(state, null, 2);
                            const blob = new Blob([data], { type: 'application/json' });
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = 'plan.json';
                            a.click();
                            URL.revokeObjectURL(url);
                        }}
                        className="inline-flex items-center gap-2 px-3 h-9 rounded-lg bg-slate-900 text-white hover:bg-black"
                    >
                        <Download className="w-4 h-4" /> Export
                    </button>
                    <button
                        onClick={() => {
                            const encoded = encodeURIComponent(btoa(unescape(encodeURIComponent(JSON.stringify(state)))));
                            const shareUrl = `${location.origin}${location.pathname}?plan=${encoded}`;
                            navigator.clipboard.writeText(shareUrl);
                            alert('Share link copied to clipboard');
                        }}
                        className="inline-flex items-center gap-2 px-3 h-9 rounded-lg border border-slate-300 text-slate-700 bg-white hover:bg-slate-50"
                    >
                        <Share2 className="w-4 h-4" /> Share
                    </button>
                    <div className="ml-auto inline-flex items-center gap-2 px-3 h-10 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200">
                        <span className="text-sm font-medium">Total Planned</span>
                        <span className="text-base font-bold">{totalPlannedCP} CP</span>
                    </div>
                </div>
            </header>

            {/* ✅ Move DndContext up here to wrap both left and right columns */}
            <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragStart={onDragStart}
                onDragEnd={onDragEnd}
            >
                <div className="flex flex-col lg:flex-row gap-6">
                    {/* Left catalog (contains SortableContext and droppable id="catalog") */}
                    <CatalogSidebar catalog={catalog} keyword={keyword} onSearch={setKeyword} programFilter={programFilter} onProgramFilter={setProgramFilter} />

                    {/* Right board (each TermColumn contains SortableContext + droppable id=term.id) */}
                    <section className="flex-1">
                        <div className="grid md:grid-cols-3 xl:grid-cols-4 gap-5">
                            {state.terms.map((t) => {
                                const cp = t.courseIds.reduce((acc, id) => acc + (coursesById.get(id)?.credits ?? 0), 0);
                                const overCP = cp > (t.limitCP ?? 24);
                                return (
                                    <TermColumn
                                        key={t.id}
                                        term={t}
                                        coursesById={coursesById}
                                        overCP={overCP}
                                    />
                                );
                            })}
                            {/* Warnings Panel */}
                            <div className="rounded-2xl bg-white border border-slate-200 shadow-sm h-fit sticky top-4">
                                <div className="px-4 py-3 border-b bg-gradient-to-r from-rose-500 to-pink-500 text-white rounded-t-2xl flex items-center justify-between">
                                    <div className="text-lg font-semibold">Planner Warnings</div>
                                </div>
                                <div className="p-4 space-y-3 max-h-[420px] overflow-auto">
                                    {warnings.length === 0 && (
                                        <div className="text-sm text-slate-500">No warnings.</div>
                                    )}
                                    {warnings.map((w, idx) => (
                                        <div key={idx} className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
                                            {w}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                        {/* Add Term button after current terms */}
                        <div className="mt-4 flex items-center gap-3">
                            <button
                                className="px-4 h-10 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700"
                                onClick={() => {
                                    setState(prev => {
                                        const terms = [...prev.terms];
                                        // Parse last term to determine next term
                                        const last = terms[terms.length - 1];
                                        const m = last?.title?.match(/(\d{4})\s+(Autumn|Spring)/);
                                        let year = m ? parseInt(m[1], 10) : parseInt(String(activePlan?.profile?.entryYear || new Date().getFullYear()), 10);
                                        let season = m ? m[2] : 'Autumn';
                                        if (season === 'Autumn') {
                                            // same year Spring
                                            season = 'Spring';
                                        } else {
                                            // Spring -> next year Autumn
                                            season = 'Autumn';
                                            year += 1;
                                        }
                                        const newTerm = { id: nanoid(), title: `${year} ${season}`, limitCP: 24, courseIds: [] };
                                        const next = { terms: [...terms, newTerm] };
                                        // Sync save to plan
                                        try {
                                            const plan = getActivePlan();
                                            if (plan) {
                                                plan.planner = next as any;
                                                plan.updatedAt = Date.now();
                                                upsertPlan(plan);
                                                window.dispatchEvent(new CustomEvent('plan-changed'));
                                            }
                                        } catch { }
                                        return next;
                                    });
                                }}
                            >
                                + Add Term
                            </button>
                            <button
                                className="px-4 h-10 rounded-lg bg-rose-600 text-white hover:bg-rose-700 disabled:opacity-50"
                                disabled={state.terms.length <= 2}
                                onClick={() => {
                                    setState(prev => {
                                        if (prev.terms.length <= 2) return prev;
                                        const next = { terms: prev.terms.slice(0, prev.terms.length - 1) };
                                        try {
                                            const plan = getActivePlan();
                                            if (plan) {
                                                plan.planner = next as any;
                                                plan.updatedAt = Date.now();
                                                upsertPlan(plan);
                                                window.dispatchEvent(new CustomEvent('plan-changed'));
                                            }
                                        } catch { }
                                        return next;
                                    });
                                }}
                            >
                                Delete Last Term
                            </button>
                        </div>
                    </section>
                </div>

                {/* Drag overlay styles (preserved) */}
                <DragOverlay
                    dropAnimation={{ duration: 180, easing: 'cubic-bezier(.2,.8,.2,1)' }}
                    modifiers={[snapCenterToCursor]}
                >
                    {activeCourse ? <CourseCardMini course={activeCourse} dragging /> : null}
                </DragOverlay>
            </DndContext>
        </div>
    );
}


