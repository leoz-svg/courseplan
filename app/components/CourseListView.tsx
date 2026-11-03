'use client';
import { useCallback } from 'react';
import { Course } from './types';
import CourseCard from './CourseCard';

export default function CourseListView({
    courses, selectedId, onSelect,
}: {
    courses: Course[];
    selectedId?: number;
    onSelect: (id: number) => void;
}) {
    if (!courses.length) {
        return <div className="p-6 text-slate-300">No courses match your filters.</div>;
    }

    const onKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
        if (!courses.length) return;
        const index = courses.findIndex(c => c.id === selectedId);
        if (e.key === 'ArrowDown') {
            const next = courses[(index + 1) % courses.length];
            onSelect(next.id);
            e.preventDefault();
        } else if (e.key === 'ArrowUp') {
            const prev = courses[(index - 1 + courses.length) % courses.length];
            onSelect(prev.id);
            e.preventDefault();
        }
    }, [courses, selectedId, onSelect]);

    return (
        <div role="listbox" aria-label="Courses" tabIndex={0} onKeyDown={onKeyDown} className="space-y-3 outline-none">
            {courses.map(c => (
                <div
                    key={c.id}
                    role="option"
                    aria-selected={selectedId === c.id}
                    tabIndex={0}
                    onClick={() => onSelect(c.id)}
                    onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onSelect(c.id)}
                    className={`text-left rounded-xl border transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 ${selectedId === c.id
                            ? 'border-indigo-400 ring-2 ring-indigo-200'
                            : 'border-slate-700 hover:bg-slate-800/60'
                        }`}
                >
                    <CourseCard course={c} />
                </div>
            ))}
        </div>
    );
}

