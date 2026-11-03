'use client';

import React, { useState, useMemo, useRef } from 'react';
import { CheckCircle, TreePine, BookOpen, Plus, X } from 'lucide-react';
import { Course } from './types';
import { getActivePlan, addCompletedCourse, removeCompletedCourse } from '../../lib/storage';
import { courses as allCourses } from '../data/courses';

interface CompletedCoursesTreeProps {
    className?: string;
}

type TreeNode = {
    course: Course;
    prerequisites?: TreeNode[];
    dependents?: TreeNode[];
};

export default function CompletedCoursesTree({ className = '' }: CompletedCoursesTreeProps) {
    const [completedCourses, setCompletedCourses] = useState<Course[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showTestButtons, setShowTestButtons] = useState(false);
    const svgRef = useRef<SVGSVGElement | null>(null);

    // Test example course codes
    const testCourses = ['48023', '48024', '48033', '37131', '41004'];

    // Get completed course data
    React.useEffect(() => {
        const loadCompletedCourses = () => {
            const plan = getActivePlan();
            if (!plan?.completedCodes?.length) {
                setCompletedCourses([]);
                setIsLoading(false);
                return;
            }

            // Convert course codes to course objects
            const completed = plan.completedCodes
                .map(code => allCourses.find(c => c.code === code))
                .filter(Boolean) as Course[];

            setCompletedCourses(completed);
            setIsLoading(false);
        };

        loadCompletedCourses();

        // Listen for plan changes
        const handler = () => loadCompletedCourses();
        window.addEventListener('plan-changed', handler as EventListener);
        return () => window.removeEventListener('plan-changed', handler as EventListener);
    }, []);

    // Remove unused functions

    // Build dependency graph for completed courses
    const buildCompletedCoursesGraph = (): TreeNode[] => {
        if (completedCourses.length === 0) return [];

        const byCode = new Map(completedCourses.map(c => [c.code, c]));
        const processed = new Set<string>();

        const buildNode = (course: Course): TreeNode => {
            if (processed.has(course.code)) {
                return { course };
            }
            processed.add(course.code);

            const prerequisites = course.prerequisites
                ?.map(code => byCode.get(code))
                .filter(Boolean) as Course[] || [];

            const dependents = completedCourses.filter(c =>
                c.prerequisites?.includes(course.code)
            );

            return {
                course,
                prerequisites: prerequisites.map(p => buildNode(p)),
                dependents: dependents.map(d => buildNode(d))
            };
        };

        // Find courses without prerequisites as root nodes
        const rootCourses = completedCourses.filter(course =>
            !course.prerequisites?.some(prereq =>
                completedCourses.some(completed => completed.code === prereq)
            )
        );

        // If no root courses, select first course as starting point
        return rootCourses.length > 0
            ? rootCourses.map(c => buildNode(c))
            : [buildNode(completedCourses[0])];
    };

    const graphData = buildCompletedCoursesGraph();

    // Render tree visualization
    const TreeVisualization = ({ data }: { data: TreeNode[] }) => {
        if (!data.length) return null;

        const NODE_W = 140;
        const NODE_H = 60;
        const LEVEL_H = 120;
        const NODE_SP = 180;
        const EDGE_STROKE = 3;

        type LayoutNode = {
            id: string;
            course: Course;
            x: number;
            y: number;
            type: 'root' | 'prerequisite' | 'dependent';
        };
        type LayoutEdge = {
            from: string;
            to: string;
            type: 'prerequisite' | 'dependent';
        };

        const layoutNodes: LayoutNode[] = [];
        const layoutEdges: LayoutEdge[] = [];

        const layoutTree = (
            node: TreeNode,
            baseX: number,
            baseY: number,
            level = 0,
            nodeIndex = 0,
            totalNodes = 1
        ) => {
            const x = baseX + (nodeIndex - (totalNodes - 1) / 2) * NODE_SP;
            const y = baseY - level * LEVEL_H; // Changed to negative value, put prerequisites on upper level
            const id = node.course.code;

            layoutNodes.push({
                id,
                course: node.course,
                x,
                y,
                type: level === 0 ? 'root' : 'prerequisite'
            });

            // Handle prerequisites - prerequisites on upper level (level + 1, smaller y value)
            if (node.prerequisites?.length) {
                node.prerequisites.forEach((prereq, i) => {
                    layoutTree(prereq, x, y, level + 1, i, node.prerequisites!.length);
                    // Arrow from prerequisite course to current course
                    layoutEdges.push({
                        from: prereq.course.code,
                        to: id,
                        type: 'prerequisite'
                    });
                });
            }

            // Handle dependent courses - dependent courses on lower level (level - 1, larger y value)
            if (node.dependents?.length) {
                node.dependents.forEach((dep, i) => {
                    layoutTree(dep, x, y, level - 1, i, node.dependents!.length);
                    // Arrow from current course to dependent course
                    layoutEdges.push({
                        from: id,
                        to: dep.course.code,
                        type: 'dependent'
                    });
                });
            }
        };

        // Layout all trees
        data.forEach((root, rootIndex) => {
            const startX = rootIndex * 400; // Spacing between each root tree
            layoutTree(root, startX, 150, 0);
        });

        // Deduplicate nodes and edges
        const nodeById = new Map<string, LayoutNode>();
        layoutNodes.forEach(n => {
            if (!nodeById.has(n.id)) {
                nodeById.set(n.id, n);
            }
        });
        const dedupNodes = Array.from(nodeById.values());

        const edgeKey = (e: LayoutEdge) => `${e.from}->${e.to}|${e.type}`;
        const edgeSeen = new Set<string>();
        const dedupEdges = layoutEdges.filter(e => {
            const k = edgeKey(e);
            if (edgeSeen.has(k)) return false;
            edgeSeen.add(k);
            return nodeById.has(e.from) && nodeById.has(e.to);
        });

        // Calculate view box
        if (dedupNodes.length === 0) return null;

        const PAD = 60;
        const minX = Math.min(...dedupNodes.map(n => n.x - NODE_W / 2));
        const minY = Math.min(...dedupNodes.map(n => n.y - NODE_H / 2));
        const maxX = Math.max(...dedupNodes.map(n => n.x + NODE_W / 2));
        const maxY = Math.max(...dedupNodes.map(n => n.y + NODE_H / 2));

        const vbX = minX - PAD;
        const vbY = minY - PAD;
        const vbW = Math.max(400, maxX - minX + PAD * 2);
        const vbH = Math.max(200, maxY - minY + PAD * 2);

        const nodeColor = (t: LayoutNode['type']) => {
            // All nodes uniformly green
            return '#10b981';
        };

        return (
            <div className="w-full h-full bg-gradient-to-br from-green-50 to-blue-50 rounded-lg">
                <svg
                    ref={svgRef}
                    width="100%"
                    height="100%"
                    viewBox={`${vbX} ${vbY} ${vbW} ${vbH}`}
                    preserveAspectRatio="xMidYMid meet"
                    className="w-full h-full"
                >
                    <defs>
                        <marker id="arrowhead-prerequisite" markerWidth="12" markerHeight="8" refX="10" refY="4" orient="auto">
                            <polygon points="0 0, 12 4, 0 8" fill="#10b981" stroke="#059669" strokeWidth="1" />
                        </marker>
                        <filter id="dropshadow" x="-50%" y="-50%" width="200%" height="200%">
                            <feDropShadow dx="2" dy="2" stdDeviation="3" floodOpacity="0.25" />
                        </filter>
                    </defs>

                    {/* Connections - only show dependent course relationships */}
                    {dedupEdges.map((e, idx) => {
                        // Only show dependent type connections (dependent courses)
                        if (e.type !== 'dependent') return null;

                        const from = dedupNodes.find(n => n.id === e.from);
                        const to = dedupNodes.find(n => n.id === e.to);
                        if (!from || !to) return null;

                        // Calculate connection start and end points - from upper level course to lower level course
                        const fromY = from.y + NODE_H / 2;
                        const toY = to.y - NODE_H / 2;

                        return (
                            <line
                                key={`${e.from}->${e.to}|${idx}`}
                                x1={from.x}
                                y1={fromY}
                                x2={to.x}
                                y2={toY}
                                stroke="#10b981"
                                strokeWidth={EDGE_STROKE}
                                markerEnd="url(#arrowhead-prerequisite)"
                                opacity={0.8}
                            />
                        );
                    })}

                    {/* Nodes */}
                    {dedupNodes.map((n, i) => (
                        <g key={`${n.id}-${i}`}>
                            <rect
                                x={n.x - NODE_W / 2}
                                y={n.y - NODE_H / 2}
                                width={NODE_W}
                                height={NODE_H}
                                rx={8}
                                fill={nodeColor(n.type)}
                                stroke="#ffffff"
                                strokeWidth={2}
                                filter="url(#dropshadow)"
                                className="cursor-pointer transition hover:brightness-110"
                            />
                            <text
                                x={n.x}
                                y={n.y - 8}
                                textAnchor="middle"
                                fontSize={12}
                                fontWeight={600}
                                fill="#fff"
                                className="pointer-events-none"
                            >
                                {n.course.code}
                            </text>
                            <text
                                x={n.x}
                                y={n.y + 8}
                                textAnchor="middle"
                                fontSize={9}
                                fill="#fff"
                                className="pointer-events-none"
                            >
                                {n.course.name.length > 18 ? n.course.name.slice(0, 18) + '...' : n.course.name}
                            </text>
                            <text
                                x={n.x}
                                y={n.y + 20}
                                textAnchor="middle"
                                fontSize={8}
                                fill="rgba(255,255,255,0.8)"
                                className="pointer-events-none"
                            >
                                {n.course.faculty}
                            </text>
                            {/* Remove button */}
                            <circle
                                cx={n.x + NODE_W / 2 - 12}
                                cy={n.y - NODE_H / 2 + 12}
                                r={8}
                                fill="#ef4444"
                                stroke="#fff"
                                strokeWidth={1}
                                className="cursor-pointer hover:brightness-110"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    removeCompletedCourse(n.course.code);
                                }}
                            />
                            <text
                                x={n.x + NODE_W / 2 - 12}
                                y={n.y - NODE_H / 2 + 16}
                                textAnchor="middle"
                                fontSize={10}
                                fill="#fff"
                                className="pointer-events-none"
                            >
                                ×
                            </text>
                        </g>
                    ))}
                </svg>
            </div>
        );
    };

    if (isLoading) {
        return (
            <div className={`bg-white rounded-lg shadow p-6 ${className}`}>
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-8 h-8 bg-gradient-to-r from-green-400 to-green-600 rounded-lg flex items-center justify-center">
                        <CheckCircle className="w-5 h-5 text-white" />
                    </div>
                    <h2 className="text-xl font-semibold text-gray-700">Completed Courses</h2>
                </div>
                <div className="h-48 flex items-center justify-center">
                    <div className="text-center text-gray-500">
                        <TreePine className="w-8 h-8 mx-auto mb-2 animate-pulse" />
                        <p>Loading completed courses...</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className={`bg-white rounded-lg shadow p-6 ${className}`}>
            <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 bg-gradient-to-r from-green-400 to-green-600 rounded-lg flex items-center justify-center">
                    <CheckCircle className="w-5 h-5 text-white" />
                </div>
                <div>
                    <h2 className="text-xl font-semibold text-gray-700">Completed Courses</h2>
                    <p className="text-sm text-gray-500">
                        {completedCourses.length} course{completedCourses.length !== 1 ? 's' : ''} completed
                    </p>
                </div>
            </div>

            {completedCourses.length === 0 ? (
                <div className="h-48 flex items-center justify-center bg-gray-50 rounded-lg">
                    <div className="text-center text-gray-500">
                        <BookOpen className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                        <h3 className="font-medium text-gray-700 mb-1">No Completed Courses Yet</h3>
                        <p className="text-sm">Start your learning journey by completing your first course!</p>
                    </div>
                </div>
            ) : (
                <div className="h-64 bg-white border border-gray-200 rounded-lg overflow-hidden">
                    <TreeVisualization data={graphData} />
                </div>
            )}

            {/* Legend */}
            {completedCourses.length > 0 && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-6 text-xs text-gray-600">
                            <div className="flex items-center gap-2">
                                <span className="inline-block w-3 h-3 rounded-full bg-green-500"></span>
                                <span>Completed Course</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="inline-block w-6 h-0.5 bg-green-500 relative">
                                    <span className="absolute -right-1 -top-0.5 w-0 h-0 border-y-[2px] border-y-transparent border-l-[4px] border-l-green-500"></span>
                                </span>
                                <span>Prerequisite</span>
                            </div>
                        </div>

                        {/* Test buttons */}
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setShowTestButtons(!showTestButtons)}
                                className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                            >
                                {showTestButtons ? 'Hide' : 'Show'} Test Tools
                            </button>
                        </div>
                    </div>

                    {/* Test button group */}
                    {showTestButtons && (
                        <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                            <div className="flex items-center gap-2 mb-2">
                                <Plus className="w-4 h-4 text-green-600" />
                                <span className="text-sm font-medium text-gray-700">Add Test Courses:</span>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {testCourses.map(code => {
                                    const course = allCourses.find(c => c.code === code);
                                    const isCompleted = completedCourses.some(c => c.code === code);
                                    return (
                                        <button
                                            key={code}
                                            onClick={() => addCompletedCourse(code)}
                                            disabled={isCompleted}
                                            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${isCompleted
                                                ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                                                : 'bg-green-100 text-green-700 hover:bg-green-200'
                                                }`}
                                        >
                                            {code} {course && `(${course.name.slice(0, 15)}...)`}
                                            {isCompleted && ' ✓'}
                                        </button>
                                    );
                                })}
                            </div>
                            {completedCourses.length > 0 && (
                                <button
                                    onClick={() => {
                                        completedCourses.forEach(course => {
                                            removeCompletedCourse(course.code);
                                        });
                                    }}
                                    className="mt-2 px-3 py-1 bg-red-100 text-red-700 rounded-full text-xs font-medium hover:bg-red-200 transition-colors"
                                >
                                    Clear All Completed
                                </button>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* Also show test buttons when no completed courses */}
            {completedCourses.length === 0 && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                    <div className="flex justify-center">
                        <button
                            onClick={() => setShowTestButtons(!showTestButtons)}
                            className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                        >
                            {showTestButtons ? 'Hide' : 'Show'} Test Tools
                        </button>
                    </div>

                    {showTestButtons && (
                        <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                            <div className="flex items-center gap-2 mb-2">
                                <Plus className="w-4 h-4 text-green-600" />
                                <span className="text-sm font-medium text-gray-700">Add Test Courses:</span>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {testCourses.map(code => {
                                    const course = allCourses.find(c => c.code === code);
                                    return (
                                        <button
                                            key={code}
                                            onClick={() => addCompletedCourse(code)}
                                            className="px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700 hover:bg-green-200 transition-colors"
                                        >
                                            {code} {course && `(${course.name.slice(0, 15)}...)`}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
