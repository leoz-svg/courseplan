'use client';
import { Course } from "./types";

export default function CourseList({
    courses,
    selectedId,
    onSelect,
    isLoading = false,
}: {
    courses: Course[];
    selectedId?: number;
    onSelect: (id: number) => void;
    isLoading?: boolean;
}) {
    if (isLoading) return <div className="p-4 text-gray-500">Loading...</div>;

    return (
        <div className="space-y-3 overflow-auto h-full pr-2">
            {courses.map(c => (
                <button
                    key={c.id}
                    onClick={() => onSelect(c.id)}
                    className={`w-full text-left block rounded-lg border p-3 hover:bg-gray-50 ${selectedId === c.id ? 'border-blue-500 ring-2 ring-blue-200' : 'border-gray-200'
                        }`}
                >
                    <div className="flex items-center justify-between">
                        <div className="font-medium">{c.code} · {c.name}</div>
                        <span className="text-xs px-2 py-0.5 rounded bg-gray-100">{c.faculty}</span>
                    </div>
                    <div className="text-sm text-gray-500">{c.level} · {c.credits}cp</div>
                </button>
            ))}
        </div>
    );
}
