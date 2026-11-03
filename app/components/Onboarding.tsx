'use client';

import { useEffect, useState, useMemo } from 'react';
import { nanoid } from 'nanoid';
import { Plan, upsertPlan, setActivePlanId, getPlans } from '../../lib/storage';
import { courses as allCourses } from '../data/courses';

type Profile = {
    program: string;
    entryYear: string;
    studentId?: string;
};

export default function Onboarding({ onComplete, planId }: { onComplete: () => void; planId?: string }) {
    const [program, setProgram] = useState('Bachelor of Engineering (Software)');
    const [entryYear, setEntryYear] = useState('2023');
    const [studentId, setStudentId] = useState('');
    const [completedCodes, setCompletedCodes] = useState<string[]>([]);
    const [planName, setPlanName] = useState<string>('');
    const [existingPlans, setExistingPlans] = useState<Plan[]>([]);

    useEffect(() => {
        // always load current plans
        setExistingPlans(getPlans());

        if (planId) {
            const plans = getPlans();
            const plan = plans.find(p => p.id === planId);
            if (plan) {
                setPlanName(plan.name || '');
                setProgram(plan.profile.program || 'Bachelor of Engineering (Software)');
                setEntryYear(plan.profile.entryYear || '2023');
                setStudentId(plan.profile.studentId || '');
                setCompletedCodes(plan.completedCodes || []);
                // still show quick-open; do not return here
            }
        }
        try {
            const raw = localStorage.getItem('completed-courses');
            if (raw) setCompletedCodes(JSON.parse(raw));
        } catch { }
        // keep quick-open up to date
        const handler = () => setExistingPlans(getPlans());
        window.addEventListener('plan-changed', handler as any);
        return () => window.removeEventListener('plan-changed', handler as any);
    }, [planId]);

    function toggleCompleted(code: string) {
        setCompletedCodes(prev => prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code]);
    }

    function handleStart() {
        const profile: Profile = { program, entryYear, studentId: studentId || undefined };
        if (planId) {
            const plans = getPlans();
            const existing = plans.find(p => p.id === planId);
            if (existing) {
                const updated: Plan = {
                    ...existing,
                    name: planName?.trim() || `${program} ${entryYear}`,
                    profile,
                    completedCodes,
                    updatedAt: Date.now(),
                };
                upsertPlan(updated);
                setActivePlanId(updated.id);
                window.dispatchEvent(new CustomEvent('plan-changed'));
                localStorage.setItem('onboarded', '1');
                onComplete();
                return;
            }
        }
        const plan: Plan = {
            id: nanoid(),
            name: planName?.trim() || `${program} ${entryYear}`,
            profile,
            completedCodes,
            planner: undefined,
            createdAt: Date.now(),
            updatedAt: Date.now(),
        };
        upsertPlan(plan);
        setActivePlanId(plan.id);
        window.dispatchEvent(new CustomEvent('plan-changed'));
        localStorage.setItem('onboarded', '1');
        onComplete();
    }

    // Filter courses based on selected program - only show courses for the selected program or "All Programs"
    const filteredCourses = useMemo(() => {
        return allCourses.filter(c => {
            const courseProgram = (c as any).program;
            return !courseProgram ||
                courseProgram === 'All Programs' ||
                courseProgram === program;
        });
    }, [program]);

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-100 via-sky-200 to-indigo-200">
            <div className="container mx-auto p-6">
                <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow-lg border border-slate-200 p-8 space-y-8">
                    <div className="text-center space-y-4">
                        <div className="space-y-2">
                            <h1 className="text-2xl font-bold text-slate-800">Welcome to UTS Course Planner! 👋</h1>
                            <p className="text-slate-600 text-lg">Let's get started by setting up your personalized study plan.</p>
                        </div>
                        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-4 border border-blue-200">
                            <h2 className="text-xl font-semibold text-slate-800 mb-2">User Profile</h2>
                            <p className="text-slate-600 text-sm">Please provide your information below to create your personalized course planner.</p>
                        </div>
                    </div>

                    {existingPlans.length > 0 && (
                        <div className="rounded-xl border border-slate-200 p-4 bg-slate-50">
                            <div className="text-sm font-semibold text-slate-800 mb-2">Open an existing plan</div>
                            <div className="flex items-center gap-2">
                                <select id="existing-plan-select" className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-black">
                                    {existingPlans.map(p => (
                                        <option key={p.id} value={p.id}>{p.name}</option>
                                    ))}
                                </select>
                                <button
                                    onClick={() => {
                                        const sel = (document.getElementById('existing-plan-select') as HTMLSelectElement);
                                        const id = sel?.value;
                                        if (id) {
                                            setActivePlanId(id);
                                            window.dispatchEvent(new CustomEvent('plan-changed'));
                                            onComplete();
                                        }
                                    }}
                                    className="px-4 h-10 rounded-lg bg-slate-900 text-white hover:bg-black"
                                >
                                    Open
                                </button>
                            </div>
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div className="md:col-span-2">
                            <label className="block text-sm font-semibold text-slate-800 mb-1">Plan Name</label>
                            <input value={planName} onChange={(e) => setPlanName(e.target.value)} className="w-full h-11 rounded-xl border border-slate-300 px-3 bg-white text-black placeholder:text-slate-500" placeholder="e.g., 2024 Software Plan" />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-slate-800 mb-1">Program</label>
                            <select value={program} onChange={(e) => setProgram(e.target.value)} className="w-full h-11 rounded-xl border border-slate-300 px-3 bg-white text-black">
                                <option>Bachelor of Engineering (Software)</option>
                                <option>Bachelor of Information Technology</option>
                                <option>Bachelor of Science (Data Science)</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-slate-800 mb-1">Entry Year</label>
                            <select value={entryYear} onChange={(e) => setEntryYear(e.target.value)} className="w-full h-11 rounded-xl border border-slate-300 px-3 bg-white text-black">
                                {Array.from({ length: 8 }).map((_, i) => {
                                    const y = 2021 + i;
                                    return <option key={y} value={String(y)}>{y}</option>;
                                })}
                            </select>
                        </div>
                        <div className="md:col-span-2">
                            <label className="block text-sm font-semibold text-slate-800 mb-1">Student ID (optional)</label>
                            <input value={studentId} onChange={(e) => setStudentId(e.target.value)} className="w-full h-11 rounded-xl border border-slate-300 px-3 bg-white text-black placeholder:text-slate-500" placeholder="e.g., 12345678" />
                        </div>
                    </div>

                    <div>
                        <div className="text-sm font-semibold text-slate-800 mb-2">Import completed courses (optional)</div>
                        <div className="text-xs text-slate-600 mb-3">
                            Showing courses for <span className="font-medium">{program}</span> and All Programs courses
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-80 overflow-auto pr-1">
                            {filteredCourses.map(c => (
                                <label key={c.id} className="inline-flex items-center justify-between gap-3 rounded-xl border border-slate-300 px-3 py-2 bg-white">
                                    <div className="min-w-0">
                                        <div className="text-sm text-black font-medium truncate">{c.code} · {c.name}</div>
                                        {c.program && <div className="text-xs text-slate-600 truncate">{c.program}</div>}
                                    </div>
                                    <input type="checkbox" checked={completedCodes.includes(String(c.code))} onChange={() => toggleCompleted(String(c.code))} />
                                </label>
                            ))}
                            {!filteredCourses.length && (
                                <div className="text-slate-500 text-sm">No courses for selected program.</div>
                            )}
                        </div>
                    </div>

                    <div className="flex justify-end">
                        <button onClick={handleStart} className="px-5 h-11 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 shadow-sm">{planId ? 'Save' : 'Create Plan'}</button>
                    </div>
                </div>
            </div>
        </div>
    );
}


