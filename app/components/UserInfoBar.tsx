'use client';

import { getActivePlan } from '../../lib/storage';
import { useEffect, useState } from 'react';
import { IdCard } from 'lucide-react';
import { courses as allCourses } from '../data/courses';

export default function UserInfoBar() {
    const [program, setProgram] = useState('');
    const [entryYear, setEntryYear] = useState('');
    const [studentId, setStudentId] = useState<string | undefined>('');
    const [planName, setPlanName] = useState('');
    const [completedCount, setCompletedCount] = useState(0);

    useEffect(() => {
        const load = () => {
            const p = getActivePlan();
            setPlanName(p?.name || '');
            setProgram(p?.profile.program || '');
            setEntryYear(p?.profile.entryYear || '');
            setStudentId(p?.profile.studentId);
            // Only count completed courses that exist in course data, consistent with Dashboard
            const validCompletedCodes = (p?.completedCodes || [])
                .filter(code => allCourses.some(c => c.code === code));
            setCompletedCount(validCompletedCodes.length);
        };
        load();
        const handler = () => load();
        window.addEventListener('plan-changed', handler as EventListener);
        return () => window.removeEventListener('plan-changed', handler as EventListener);
    }, []);

    if (!program && !entryYear) return null;

    return (
        <div className="bg-white rounded-lg shadow p-5 mb-4 border border-slate-200">
            <div className="flex items-center mb-3">
                <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-md flex items-center justify-center mr-2">
                    <IdCard className="w-5 h-5 text-white" />
                </div>
                <h2 className="text-xl font-semibold text-gray-700">User Info</h2>
            </div>
            <div className="mt-1 text-slate-900 font-medium">Plan: {planName}</div>
            <div className="text-slate-800">Program: {program}</div>
            <div className="text-slate-800">Entry Year: {entryYear}</div>
            {studentId && <div className="text-slate-800">Student ID: {studentId}</div>}
            <div className="text-slate-800">Completed Courses: {completedCount}</div>
        </div>
    );
}


