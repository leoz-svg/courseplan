'use client';

import React, { useState, useMemo, useRef } from 'react';
import { Network, Search, BookOpen, TreePine, Eye, ChevronRight } from 'lucide-react';
import { Course } from './types';

type Props = {
    courses: Course[];
    onNodeClick?: (course: Course) => void;
    selectedCourse?: Course | null;
    isLoading?: boolean;
    allCourses?: Course[]; // Add original course data
    searchTerm?: string; // Add search criteria
    faculty?: string; // Add faculty filter
    level?: string; // Add level filter
    program?: string; // Add program filter
};

type TreeNode = { course: Course; prerequisites?: TreeNode[]; dependents?: TreeNode[] };

export default function CourseNetworkGraph({
    courses,
    onNodeClick,
    selectedCourse,
    isLoading,
    allCourses = [],
    searchTerm = '',
    faculty = 'All',
    level = 'All',
    program = 'All',
}: Props) {
    const [internalSearchTerm, setInternalSearchTerm] = useState('');
    const [focusedCourse, setFocusedCourse] = useState<Course | null>(selectedCourse ?? null);
    const [viewMode, setViewMode] = useState<'tree' | 'cards'>('tree');
    const svgRef = useRef<SVGSVGElement | null>(null);

    const getTitle = (c: any) => c?.name || c?.title || '';
    const getCP = (c: any) => c?.credits ?? c?.credit_points ?? null;

    const getFacultyColor = (faculty?: string) => {
        const colors: Record<string, string> = {
            Engineering: '#3b82f6',
            Business: '#10b981',
            Science: '#8b5cf6',
            Design: '#f59e0b',
            Health: '#ef4444',
            Law: '#6366f1',
            Arts: '#ec4899',
        };
        if (!faculty) return '#64748b';
        return colors[faculty] || '#64748b';
    };

    /** ---------------- Build dependency tree (with visited, prevent duplicates/cycles) ---------------- */
    const buildTreeData = (center?: Course | null): TreeNode | null => {
        if (!center) return null;

        const byCode = new Map(courses.map((c) => [String((c as any).code).trim(), c]));

        const buildPrereq = (course: Course, depth = 0, visited = new Set<string>()): TreeNode[] => {
            if (depth > 3) return [];
            const prereqCodes: string[] = ((course as any).prerequisites ?? []).map((s: any) =>
                String(s).trim()
            );
            const out: TreeNode[] = [];
            for (const code of prereqCodes) {
                if (visited.has(code)) continue;
                visited.add(code);
                const pc = byCode.get(code);
                if (pc) {
                    out.push({
                        course: pc,
                        prerequisites: buildPrereq(pc, depth + 1, visited),
                    });
                }
            }
            return out;
        };

        const buildDependents = (course: Course, depth = 0, visited = new Set<string>()): TreeNode[] => {
            if (depth > 3) return [];
            const code = String((course as any).code);
            const dependents = courses.filter((c) =>
                ((c as any).prerequisites ?? []).map(String).includes(code)
            );
            const out: TreeNode[] = [];
            for (const dep of dependents) {
                const depCode = String((dep as any).code);
                if (visited.has(depCode)) continue;
                visited.add(depCode);
                out.push({
                    course: dep,
                    dependents: buildDependents(dep, depth + 1, visited),
                });
            }
            return out;
        };

        return {
            course: center,
            prerequisites: buildPrereq(center),
            dependents: buildDependents(center),
        };
    };

    const treeData = buildTreeData(focusedCourse || selectedCourse || null);

    /** ---------------- Left side filtering/list ---------------- */
    const filteredCourses = useMemo(() => {
        // Use original course data for filtering
        const sourceCourses = allCourses.length > 0 ? allCourses : courses;

        const key = (searchTerm || internalSearchTerm).trim().toLowerCase();
        const list = sourceCourses.filter((c) => {
            // Search filtering
            const code = String((c as any).code || '').toLowerCase();
            const title = getTitle(c).toLowerCase();
            const matchSearch = !key || code.includes(key) || title.includes(key);

            // Faculty filtering
            const matchFaculty = faculty === 'All' || c.faculty === faculty;

            // Level filtering
            const matchLevel = level === 'All' || String(c.level) === level;

            // Program filtering
            const matchProgram = program === 'All' || String((c as any).program) === program;

            return matchSearch && matchFaculty && matchLevel && matchProgram;
        });

        // When no search criteria, show all filtered courses
        // When search criteria exists, show first 20 search results
        return key ? list.slice(0, 20) : list;
    }, [allCourses, courses, searchTerm, internalSearchTerm, faculty, level, program]);

    const CourseCard = ({
        course,
        onClick,
        isSelected,
    }: {
        course: Course;
        onClick: (c: Course) => void;
        isSelected?: boolean;
    }) => (
        <div
            className={`cursor-pointer rounded-xl border p-3 transition-all duration-200 hover:shadow ${isSelected ? 'border-blue-500 bg-blue-50' : 'border-slate-200 bg-white'
                } text-slate-900`}
            onClick={() => onClick(course)}
        >
            <div className="flex items-start justify-between mb-2">
                <div
                    className="w-3 h-3 rounded-full shrink-0 mt-1"
                    style={{ backgroundColor: getFacultyColor((course as any).faculty) }}
                />
            </div>
            <h4 className="font-bold text-sm mb-1">{(course as any).code}</h4>
            <p className="text-xs text-slate-600 line-clamp-2 mb-2">{getTitle(course)}</p>
            <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">{(course as any).faculty}</span>
                {getCP(course) != null && (
                    <span className="text-xs font-medium text-slate-700">{getCP(course)}CP</span>
                )}
            </div>
        </div>
    );

    /** ---------------- Right side SVG tree visualization ---------------- */
    const TreeVisualization = ({ data }: { data: TreeNode | null }) => {
        if (!data) return null;

        const NODE_W = 160;
        const NODE_H = 80;
        const LEVEL_H = 120;
        const NODE_SP = 180;

        // Connection/arrow affects boundary
        const EDGE_STROKE = 3;
        const ARROW_LEN = 12;

        type LayoutNode = {
            id: string;
            course: Course;
            x: number;
            y: number;
            type: 'center' | 'prerequisite' | 'dependent';
        };
        type LayoutEdge = {
            from: string;
            to: string;
            type: 'prerequisite' | 'dependent';
        };

        const layoutNodes: LayoutNode[] = [];
        const layoutEdges: LayoutEdge[] = [];

        const centerX = 480;
        const centerY = 300;
        const ID = (c: Course) => String((c as any).code);

        const centerId = ID(data.course);
        layoutNodes.push({ id: centerId, course: data.course, x: centerX, y: centerY, type: 'center' });

        const layoutPrereq = (
            items: TreeNode[] | undefined,
            parentId: string,
            baseX: number,
            baseY: number,
            level = 1
        ) => {
            if (!items || !items.length) return;
            const totalWidth = (items.length - 1) * NODE_SP;
            const startX = baseX - totalWidth / 2;

            items.forEach((item, i) => {
                const x = startX + i * NODE_SP;
                const y = baseY - level * LEVEL_H;
                const id = ID(item.course);

                layoutNodes.push({ id, course: item.course, x, y, type: 'prerequisite' });
                layoutEdges.push({ from: id, to: parentId, type: 'prerequisite' });

                if (item.prerequisites?.length) {
                    layoutPrereq(item.prerequisites, id, x, y, level + 1);
                }
            });
        };

        const layoutDeps = (
            items: TreeNode[] | undefined,
            parentId: string,
            baseX: number,
            baseY: number,
            level = 1
        ) => {
            if (!items || !items.length) return;
            const totalWidth = (items.length - 1) * NODE_SP;
            const startX = baseX - totalWidth / 2;

            items.forEach((item, i) => {
                const x = startX + i * NODE_SP;
                const y = baseY + level * LEVEL_H;
                const id = ID(item.course);

                layoutNodes.push({ id, course: item.course, x, y, type: 'dependent' });
                layoutEdges.push({ from: parentId, to: id, type: 'dependent' });

                if (item.dependents?.length) {
                    layoutDeps(item.dependents, id, x, y, level + 1);
                }
            });
        };

        layoutPrereq(data.prerequisites, centerId, centerX, centerY, 1);
        layoutDeps(data.dependents, centerId, centerX, centerY, 1);

        /** ---- Deduplicate before rendering ---- */
        const nodeById = new Map<string, LayoutNode>();
        for (const n of layoutNodes) {
            const id = String((n.course as any).code);
            if (!nodeById.has(id)) nodeById.set(id, { ...n, id });
        }
        const dedupNodes = Array.from(nodeById.values());

        const edgeKey = (e: LayoutEdge) => `${e.from}->${e.to}|${e.type}`;
        const edgeSeen = new Set<string>();
        const dedupEdges: LayoutEdge[] = [];
        for (const e of layoutEdges) {
            const k = edgeKey(e);
            if (edgeSeen.has(k)) continue;
            if (nodeById.has(e.from) && nodeById.has(e.to)) {
                edgeSeen.add(k);
                dedupEdges.push(e);
            }
        }

        /** ---- Calculate viewBox (including arrows/line width) and add "bottom extra space" ---- */
        const PAD = 80;                  // General padding, larger than before
        const EXTRA_BOTTOM = NODE_H;     // Extra space for bottom equal to one node height

        let minX = Infinity,
            minY = Infinity,
            maxX = -Infinity,
            maxY = -Infinity;

        // Node rectangles
        dedupNodes.forEach((n) => {
            const x0 = n.x - NODE_W / 2;
            const y0 = n.y - NODE_H / 2;
            const x1 = n.x + NODE_W / 2;
            const y1 = n.y + NODE_H / 2;
            minX = Math.min(minX, x0);
            minY = Math.min(minY, y0);
            maxX = Math.max(maxX, x1);
            maxY = Math.max(maxY, y1);
        });

        // Connection endpoints (including arrow length/line width)
        dedupEdges.forEach((e) => {
            const from = dedupNodes.find((n) => n.id === e.from);
            const to = dedupNodes.find((n) => n.id === e.to);
            if (!from || !to) return;
            const fx = from.x;
            const fy = from.y + NODE_H / 2 + ARROW_LEN + EDGE_STROKE;
            const tx = to.x;
            const ty = to.y - NODE_H / 2 - ARROW_LEN - EDGE_STROKE;
            minX = Math.min(minX, fx, tx);
            maxX = Math.max(maxX, fx, tx);
            minY = Math.min(minY, fy, ty);
            maxY = Math.max(maxY, fy, ty);
        });

        if (!isFinite(minX)) {
            minX = 0;
            minY = 0;
            maxX = NODE_W;
            maxY = NODE_H;
        }

        // Key: add extra space at bottom to prevent last row nodes being cut off by container bottom corners
        const vbX = minX - PAD;
        const vbY = minY - PAD;
        const vbW = Math.max(420, maxX - minX + PAD * 2);
        const vbH = Math.max(320, maxY - minY + PAD * 2 + EXTRA_BOTTOM);

        const nodeColor = (t: LayoutNode['type']) =>
            t === 'center' ? '#3b82f6' : t === 'prerequisite' ? '#ef4444' : '#10b981';
        const nodeBorder = (t: LayoutNode['type']) =>
            t === 'center' ? '#1d4ed8' : t === 'prerequisite' ? '#dc2626' : '#059669';

        return (
            <div className="w-full h-full overflow-auto bg-gradient-to-br from-slate-50 to-slate-100 rounded-xl">
                <svg
                    ref={svgRef}
                    width="100%"
                    height="100%"
                    viewBox={`${vbX} ${vbY} ${vbW} ${vbH}`}
                    preserveAspectRatio="xMidYMid meet"
                    className="w-full h-full"
                >
                    <defs>
                        <marker id="arrowhead-red" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                            <polygon points="0 0, 10 3.5, 0 7" fill="#ef4444" />
                        </marker>
                        <marker id="arrowhead-green" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                            <polygon points="0 0, 10 3.5, 0 7" fill="#10b981" />
                        </marker>
                        <filter id="dropshadow" x="-50%" y="-50%" width="200%" height="200%">
                            <feDropShadow dx="2" dy="2" stdDeviation="3" floodOpacity="0.25" />
                        </filter>
                    </defs>

                    {/* edges */}
                    {dedupEdges.map((e, idx) => {
                        const from = dedupNodes.find((n) => n.id === e.from);
                        const to = dedupNodes.find((n) => n.id === e.to);
                        if (!from || !to) return null;
                        const marker = e.type === 'prerequisite' ? 'url(#arrowhead-red)' : 'url(#arrowhead-green)';
                        const stroke = e.type === 'prerequisite' ? '#ef4444' : '#10b981';
                        return (
                            <line
                                key={`${e.from}->${e.to}|${e.type}|${idx}`}
                                x1={from.x}
                                y1={from.y + NODE_H / 2}
                                x2={to.x}
                                y2={to.y - NODE_H / 2}
                                stroke={stroke}
                                strokeWidth={EDGE_STROKE}
                                markerEnd={marker}
                                opacity={0.75}
                            />
                        );
                    })}

                    {/* nodes */}
                    {dedupNodes.map((n, i) => (
                        <g key={`${n.id}-${n.x}-${n.y}-${i}`}>
                            <rect
                                x={n.x - NODE_W / 2}
                                y={n.y - NODE_H / 2}
                                width={NODE_W}
                                height={NODE_H}
                                rx={10}
                                fill={nodeColor(n.type)}
                                stroke={nodeBorder(n.type)}
                                strokeWidth={2}
                                filter="url(#dropshadow)"
                                className="cursor-pointer transition hover:brightness-110"
                                onClick={() => {
                                    setFocusedCourse(n.course);
                                    onNodeClick?.(n.course);
                                }}
                            />
                            <text x={n.x} y={n.y - 8} textAnchor="middle" fontSize={14} fontWeight={700} fill="#fff" className="pointer-events-none">
                                {(n.course as any).code}
                            </text>
                            <text x={n.x} y={n.y + 10} textAnchor="middle" fontSize={10} fill="#fff" className="pointer-events-none">
                                {getTitle(n.course).slice(0, 24)}
                                {getTitle(n.course).length > 24 ? '…' : ''}
                            </text>
                            <text x={n.x} y={n.y + 26} textAnchor="middle" fontSize={9} fill="rgba(255,255,255,.85)" className="pointer-events-none">
                                {(n.course as any).faculty}
                            </text>
                        </g>
                    ))}
                </svg>
            </div>
        );
    };

    if (isLoading) {
        return (
            <div className="h-[700px] flex items-center justify-center rounded-2xl border border-slate-200 bg-white">
                <div className="text-center text-slate-500">
                    <Network className="w-12 h-12 mx-auto mb-4 animate-pulse" />
                    <p>Loading course tree...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6 h-[700px] overflow-hidden">
            {/* Top: search + view toggle */}
            <div className="rounded-2xl border border-slate-200 bg-white">
                <div className="p-4 flex gap-4 items-center">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                            placeholder="Search courses to explore tree structure..."
                            value={internalSearchTerm}
                            onChange={(e) => setInternalSearchTerm(e.target.value)}
                            className="w-full rounded-xl border border-slate-300 bg-white pl-10 pr-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500/50"
                        />
                    </div>
                    <div className="flex gap-2">
                        <button
                            type="button"
                            onClick={() => setViewMode('tree')}
                            className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium ${viewMode === 'tree'
                                ? 'bg-indigo-600 text-white border-indigo-600'
                                : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                                }`}
                        >
                            <TreePine className="w-4 h-4" />
                            Tree View
                        </button>
                        <button
                            type="button"
                            onClick={() => setViewMode('cards')}
                            className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium ${viewMode === 'cards'
                                ? 'bg-indigo-600 text-white border-indigo-600'
                                : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                                }`}
                        >
                            <Eye className="w-4 h-4" />
                            Card View
                        </button>
                    </div>
                </div>
            </div>

            {/* Layout: parent grid/columns/content layers all min-h-0, list scrolls independently + large bottom padding */}
            <div className="grid grid-cols-12 gap-6 h-full min-h-0">
                {/* Left column */}
                <div className="col-span-12 lg:col-span-3 flex flex-col min-h-0">
                    <h3 className="font-semibold text-slate-700 flex items-center gap-2 px-1">
                        <BookOpen className="w-4 h-4" />
                        {(searchTerm || internalSearchTerm) ? 'Search Results' : `All Courses (${filteredCourses.length})`}
                    </h3>

                    <div className="mt-2 flex-1 min-h-0 overflow-y-auto pr-1">
                        <div className="flex flex-col gap-3 pb-24">
                            {filteredCourses.map((c) => (
                                <CourseCard
                                    key={(c as any).id ?? (c as any).code}
                                    course={c}
                                    isSelected={focusedCourse?.code === (c as any).code}
                                    onClick={(course) => {
                                        setFocusedCourse(course);
                                        onNodeClick?.(course);
                                    }}
                                />
                            ))}
                            <div aria-hidden className="h-8" />
                        </div>
                    </div>
                </div>

                {/* Right column */}
                <div className="col-span-12 lg:col-span-9 min-h-0">
                    {focusedCourse || selectedCourse ? (
                        <div className="h-full rounded-2xl border border-slate-200 bg-white flex flex-col">
                            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
                                <div>
                                    <div className="text-slate-900 font-semibold flex items-center gap-2">
                                        <TreePine className="w-5 h-5 text-blue-600" />
                                        Course Dependency Tree
                                    </div>
                                    <p className="text-sm text-slate-500">
                                        Explore how {(focusedCourse || (selectedCourse as any))?.code} connects to other courses
                                    </p>
                                </div>
                                <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 text-blue-700 text-xs px-3 py-1 border border-blue-200">
                                    {(focusedCourse || (selectedCourse as any))?.code}
                                </span>
                            </div>

                            <div className="flex-1 p-0 min-h-0">
                                {viewMode === 'tree' ? (
                                    <TreeVisualization data={treeData} />
                                ) : (
                                    <div className="p-6 text-slate-500 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                        {(treeData?.dependents ?? []).map((d) => (
                                            <CourseCard
                                                key={(d.course as any).code}
                                                course={d.course}
                                                onClick={(course) => {
                                                    setFocusedCourse(course);
                                                    onNodeClick?.(course);
                                                }}
                                            />
                                        ))}
                                        {(treeData?.prerequisites ?? []).map((p) => (
                                            <CourseCard
                                                key={(p.course as any).code}
                                                course={p.course}
                                                onClick={(course) => {
                                                    setFocusedCourse(course);
                                                    onNodeClick?.(course);
                                                }}
                                            />
                                        ))}
                                        {!(treeData?.dependents?.length || treeData?.prerequisites?.length) && (
                                            <div className="col-span-full text-center text-slate-500 py-8">
                                                <ChevronRight className="w-5 h-5 inline-block mr-1" />
                                                No related courses found.
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="h-full rounded-2xl border border-slate-200 bg-white flex items-center justify-center">
                            <div className="text-center px-6 py-10">
                                <TreePine className="w-16 h-16 text-slate-300 mx-auto mb-3" />
                                <h3 className="font-semibold text-slate-700 mb-1">Explore Course Dependencies</h3>
                                <p className="text-slate-500">
                                    Select a course from the left panel to view its dependency tree
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}














