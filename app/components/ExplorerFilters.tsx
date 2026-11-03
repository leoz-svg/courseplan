'use client';

export default function ExplorerFilters({
    faculty,
    level,
    onFaculty,
    onLevel,
    faculties,
    levels,
    program = 'All',
    programs = [],
    onProgram,
}: {
    faculty: string;
    level: string;
    onFaculty: (f: string) => void;
    onLevel: (l: string) => void;
    faculties: string[];
    levels: string[];
    program?: string;
    programs?: string[];
    onProgram?: (p: string) => void;
}) {
    return (
        <div className="flex flex-wrap items-center gap-3">
            <select
                value={program}
                onChange={(e) => onProgram && onProgram(e.target.value)}
                className="h-10 px-3 rounded-xl bg-slate-800 border border-slate-700 text-slate-100"
            >
                {(programs.length ? programs : ['All']).map((p) => (
                    <option key={p} value={p}>
                        {p === 'All' ? 'All Programs Courses' : p === 'All Programs' ? 'All Programs Can Select' : p}
                    </option>
                ))}
            </select>

            <select
                value={faculty}
                onChange={(e) => onFaculty(e.target.value)}
                className="h-10 px-3 rounded-xl bg-slate-800 border border-slate-700 text-slate-100"
            >
                {faculties.map((f) => (
                    <option key={f} value={f}>
                        {f === 'All' ? 'All Faculties' : f}
                    </option>
                ))}
            </select>

            <select
                value={level}
                onChange={(e) => onLevel(e.target.value)}
                className="h-10 px-3 rounded-xl bg-slate-800 border border-slate-700 text-slate-100"
            >
                {levels.map((l) => (
                    <option key={l} value={l}>
                        {l === 'All' ? 'All Levels' : l}
                    </option>
                ))}
            </select>
        </div>
    );
}
