'use client';

import { NavItem } from './types';
import { useEffect, useMemo, useState } from 'react';
import PlansManager from './PlansManager';
import { getActivePlan } from '../../lib/storage';
import { courses as allCourses } from '../data/courses';

interface NavigationProps {
    activeNav: string;
    setActiveNav: (nav: string) => void;
    navItems: NavItem[];
}

export default function Navigation({ activeNav, setActiveNav, navItems }: NavigationProps) {
    const [showPlans, setShowPlans] = useState(false);
    const [completedCount, setCompletedCount] = useState(0);
    const [availableCount, setAvailableCount] = useState(0);
    const totalCP = 144;

    useEffect(() => {
        const load = () => {
            const plan = getActivePlan();
            // Only count completed courses that exist in course data, consistent with other components
            const validCompletedCodes = (plan?.completedCodes || [])
                .filter(code => allCourses.some(c => c.code === code));
            setCompletedCount(validCompletedCodes.length);

            const program = plan?.profile?.program;
            if (program) {
                const count = (allCourses as any[]).filter(c => {
                    const p = (c as any).program;
                    return p === program || p === 'All Programs';
                }).length;
                setAvailableCount(count);
            } else {
                setAvailableCount((allCourses as any[]).length);
            }
        };
        load();
        const handler = () => load();
        window.addEventListener('plan-changed', handler as EventListener);
        return () => window.removeEventListener('plan-changed', handler as EventListener);
    }, []);

    const earnedCP = completedCount * 6;
    const progress = Math.min(100, Math.round((earnedCP / totalCP) * 1000) / 10);
    const remaining = Math.max(0, totalCP - earnedCP);

    return (
        <div className="w-full lg:w-1/4 bg-white rounded-lg shadow p-5">
            <h2 className="text-xl font-semibold text-gray-700 mb-4">NAVIGATION</h2>
            <nav>
                <ul className="space-y-2">
                    {navItems.map((item) => {
                        const IconComponent = item.icon;
                        return (
                            <li key={item.id}>
                                <button
                                    onClick={() => setActiveNav(item.label)}
                                    className={`w-full text-left flex items-center p-3 rounded-lg transition-colors ${activeNav === item.label
                                        ? 'bg-blue-100 text-blue-700 font-medium'
                                        : 'hover:bg-gray-100 text-gray-600'
                                        }`}
                                >
                                    {IconComponent && <IconComponent className="w-5 h-5 mr-3" />}
                                    {item.label}
                                </button>
                            </li>
                        );
                    })}
                </ul>
            </nav>

            <div className="mt-8">
                <div className="mb-6">
                    <h3 className="text-lg font-medium text-gray-700 mb-2">Quick Status</h3>
                    <div className="flex justify-between text-sm text-gray-600 mb-1">
                        <span>Courses Available</span>
                        <span className="font-medium">{availableCount}</span>
                    </div>
                    <div className="flex justify-between text-sm text-gray-600 mb-1">
                        <span>Your Progress</span>
                        <span className="font-medium">{progress}%</span>
                    </div>
                    <div className="flex justify-between text-sm text-gray-600">
                        <span>Remaining CP</span>
                        <span className="font-medium">{remaining}</span>
                    </div>
                </div>
                <button onClick={() => setShowPlans(true)} className="w-full h-10 rounded-lg bg-slate-900 text-white font-medium hover:bg-black">Manage Plans</button>
                <button
                    onClick={() => {
                        try {
                            const plan = getActivePlan();
                            if (plan?.id) localStorage.setItem('onboarding-plan-id', plan.id);
                        } catch { }
                        // force open onboarding on reload explicitly
                        localStorage.setItem('force-onboarding', '1');
                        location.reload();
                    }}
                    className="w-full h-10 mt-2 rounded-lg bg-slate-100 text-slate-800 font-medium hover:bg-slate-200 border border-slate-300"
                >
                    Return to Welcome Page
                </button>
            </div>
            {showPlans && <PlansManager onClose={() => setShowPlans(false)} />}
        </div>
    );
}