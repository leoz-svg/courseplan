import { ExternalLink } from 'lucide-react';
import { Course } from './types';

interface CourseCardProps {
    course: Course;
    onClick?: () => void;
    showAddButton?: boolean; // Keep old property, default not showing add button
}

export default function CourseCard({ course, onClick, showAddButton = false }: CourseCardProps) {
    const manualUrl = `https://handbook.uts.edu.au/subjects/${course.code}.html`;

    return (
        <div
            onClick={onClick}
            className="rounded-xl border border-slate-700 bg-slate-900/60 p-4 hover:bg-slate-900 transition-colors cursor-pointer"
        >
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <div className="text-slate-300 text-xs font-mono">{course.code}</div>
                    <div className="text-slate-50 text-lg font-semibold leading-snug truncate">{course.name}</div>
                </div>

                <a
                    href={manualUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    aria-label="Open subject in UTS Handbook"
                    className="shrink-0 inline-flex items-center gap-1 rounded-md border border-slate-700 px-2 py-1 text-xs text-slate-300 hover:text-white hover:border-slate-500"
                >
                    <ExternalLink className="h-4 w-4" />
                </a>
            </div>

            {course.description ? (
                <p className="mt-2 text-sm leading-6 text-slate-300">
                    {course.description}
                </p>
            ) : null}

            <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-slate-800 px-2 py-0.5 text-xs text-slate-300">
                    {String(course.level).toLowerCase()}
                </span>
                <span className="rounded-full bg-slate-800 px-2 py-0.5 text-xs text-slate-300">
                    {course.faculty}
                </span>
                <span className="rounded-full bg-slate-800 px-2 py-0.5 text-xs text-slate-300">
                    {course.credits} CP
                </span>
            </div>

            {showAddButton && (
                <button
                    type="button"
                    className="mt-3 w-full rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-500"
                >
                    Add to Plan
                </button>
            )}
        </div>
    );
}
