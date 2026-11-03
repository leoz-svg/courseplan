'use client';
import { useMemo, useState } from 'react';
import { Course } from './types';
import ExplorerHeader from './ExplorerHeader';
import ExplorerFilters from './ExplorerFilters';
import CourseNetworkGraph from './CourseNetworkGraph';
import CourseListView from './CourseListView';
import CourseDetails from './CourseDetails';
import { Info } from 'lucide-react';

type ViewMode = 'network' | 'list';

export default function CourseExplorer({ courses = [] }: { courses?: Course[] }) {
    const [view, setView] = useState<ViewMode>('network'); // Default network view, consistent with screenshot
    const [search, setSearch] = useState('');
    const [faculty, setFaculty] = useState('All');
    const [level, setLevel] = useState('All');
    const [program, setProgram] = useState('All');
    const [selectedId, setSelectedId] = useState<number | undefined>(undefined);

    const faculties = useMemo(
        () => ['All', ...Array.from(new Set(courses.map((c) => c.faculty).filter(Boolean)))],
        [courses]
    );
    const levels = useMemo(
        () => ['All', ...Array.from(new Set(courses.map((c) => c.level).filter(Boolean)))],
        [courses]
    );
    const programs = useMemo(
        () => ['All', ...Array.from(new Set((courses as any[]).map((c) => (c as any).program).filter(Boolean)))],
        [courses]
    );

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        return courses.filter((c) => {
            const matchText = `${c.code} ${c.name} ${c.faculty} ${c.level ?? ''}`.toLowerCase();
            const okQ = !q || matchText.includes(q);
            const okF = faculty === 'All' || c.faculty === faculty;
            const okL = level === 'All' || String(c.level) === level;
            const okP = program === 'All' || String((c as any).program) === program;
            return okQ && okF && okL && okP;
        });
    }, [courses, search, faculty, level, program]);

    // Selected complete course object (for right side details & passed to CourseNetworkGraph)
    const selected = useMemo(
        () => filtered.find((c) => c.id === selectedId),
        [filtered, selectedId]
    );

    return (
        <div className="space-y-4">
            {/* Top card: header + filters */}
            <section className="bg-slate-900/60 border border-slate-700 rounded-2xl p-4 space-y-4">
                <ExplorerHeader view={view} onChangeView={setView} search={search} onSearch={setSearch} />
                <div className="flex items-center justify-between gap-4">
                    <ExplorerFilters
                        program={program}
                        programs={programs}
                        onProgram={setProgram}
                        faculty={faculty}
                        level={level}
                        onFaculty={setFaculty}
                        onLevel={setLevel}
                        faculties={faculties}
                        levels={levels}
                    />
                </div>
            </section>

            <div className="grid grid-cols-12 gap-4">
                {/* Left side: network graph or list */}
                <div className="col-span-12 lg:col-span-8 space-y-4">
                    <section className="bg-slate-900/60 border border-slate-700 rounded-2xl">
                        <div className="p-4">
                            {view === 'list' ? (
                                // Keep your original list interface (selectedId / onSelect)
                                <CourseListView courses={filtered} selectedId={selectedId} onSelect={setSelectedId} />
                            ) : (
                                // Changed to new interface: selectedCourse / onNodeClick
                                <CourseNetworkGraph
                                    courses={filtered}
                                    selectedCourse={selected ?? null}
                                    onNodeClick={(c: Course) => setSelectedId(c.id)}
                                    allCourses={courses}
                                    searchTerm={search}
                                    faculty={faculty}
                                    level={level}
                                    program={program}
                                />
                            )}
                        </div>
                    </section>
                </div>

                {/* Right side: details + legend */}
                <div className="col-span-12 lg:col-span-4 space-y-4">
                    <section className="bg-slate-900/60 border border-slate-700 rounded-2xl">
                        <div className="border-b border-slate-700 px-4 py-3 text-slate-200 text-base">Details</div>
                        <div className="p-4">
                            <CourseDetails course={selected} all={filtered} />
                        </div>
                    </section>

                    <section className="bg-slate-900/60 border border-slate-700 rounded-2xl">
                        <div className="border-b border-slate-700 px-4 py-3 text-slate-200 text-base flex items-center gap-2">
                            <Info className="w-4 h-4 text-slate-400" />
                            <span>Network Legend</span>
                        </div>
                        <div className="p-4 text-slate-300 text-sm space-y-3">
                            <div className="flex items-center gap-3">
                                <span className="inline-block w-3.5 h-3.5 rounded-full" style={{ background: '#10B981' }} />
                                <span>Undergraduate</span>
                            </div>
                            <div className="flex items-center gap-3">
                                <span className="inline-block w-3.5 h-3.5 rounded-full" style={{ background: '#8B5CF6' }} />
                                <span>Postgraduate</span>
                            </div>
                            <div className="flex items-center gap-3">
                                <span className="inline-block w-8 h-0.5 bg-green-500 relative">
                                    <span className="absolute -right-1.5 -top-1 w-0 h-0 border-y-[4px] border-y-transparent border-l-[7px] border-l-green-500" />
                                </span>
                                <span>Prerequisite</span>
                            </div>

                        </div>
                    </section>
                </div>
            </div>
        </div>
    );
}


