"use client";
import { Sparkles, Lightbulb } from 'lucide-react';
import { Course } from './types';
import { getActivePlan } from '../../lib/storage';
import CourseCard from './CourseCard';
import CompletedCoursesTree from './CompletedCoursesTree';
import ProgressPieChart from './ProgressPieChart';
import { useEffect, useState } from 'react';
import { courses as allCourses } from '../data/courses';

interface DashboardProps {
    recommendedCourses: Course[];
    onExploreCourses?: () => void;
}

export default function Dashboard({ recommendedCourses, onExploreCourses }: DashboardProps) {
    const [completedCount, setCompletedCount] = useState(0);
    const [availableCount, setAvailableCount] = useState(0);
    const [activity, setActivity] = useState<{ id: string; ts: number; message: string }[]>([]);
    const [recs, setRecs] = useState<Course[]>([]);

    const totalCP = 144; // unified total degree credits
    const earnedCP = completedCount * 6;
    const progress = Math.min(100, Math.round((earnedCP / totalCP) * 1000) / 10);

    useEffect(() => {
        const load = () => {
            const plan = getActivePlan();
            // Only count completed courses that exist in course data
            const validCompletedCodes = (plan?.completedCodes || [])
                .filter(code => allCourses.some(c => c.code === code));
            setCompletedCount(validCompletedCodes.length);
            setActivity(plan?.activity || []);
            // compute available by program
            const program = plan?.profile?.program;
            if (program) {
                const list = (allCourses as any[]).filter(c => (c as any).program === program || (c as any).program === 'All Programs');
                setAvailableCount(list.length);
                // recommendations: pick 4 random from program courses (exclude completed)
                const completed = new Set((plan?.completedCodes || []).map(String));
                const pool = list.filter(c => !completed.has(String((c as any).code)));
                const shuffled = [...pool].sort(() => Math.random() - 0.5);
                setRecs(shuffled.slice(0, 4) as Course[]);
            } else {
                setAvailableCount((allCourses as any[]).length);
                const shuffled = [...(allCourses as Course[])].sort(() => Math.random() - 0.5);
                setRecs(shuffled.slice(0, 4));
            }
        };
        load();
        const handler = () => load();
        window.addEventListener('plan-changed', handler as any);
        return () => window.removeEventListener('plan-changed', handler as any);
    }, []);

    return (
        <>
            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-6">
                {/* Available Courses Card */}
                <div className="bg-white rounded-lg shadow p-5">
                    <h3 className="text-gray-500 text-sm font-medium mb-2">Available Courses</h3>
                    <div className="flex items-baseline">
                        <span className="text-3xl font-bold text-gray-800">{availableCount}</span>
                        <span className="ml-2 text-sm text-green-500 font-medium">by program</span>
                    </div>
                </div>

                {/* Completed Courses Card */}
                <div className="bg-white rounded-lg shadow p-5">
                    <h3 className="text-gray-500 text-sm font-medium mb-2">Completed Courses</h3>
                    <div className="flex items-baseline">
                        <span className="text-3xl font-bold text-gray-800">{completedCount}</span>
                        <span className="ml-2 text-sm text-green-500 font-medium">updated</span>
                    </div>
                </div>

                {/* Credit Points Card */}
                <div className="bg-white rounded-lg shadow p-5">
                    <h3 className="text-gray-500 text-sm font-medium mb-2">Credit Points Earned</h3>
                    <div className="flex items-baseline">
                        <span className="text-3xl font-bold text-gray-800">{earnedCP}</span>
                        <span className="ml-2 text-sm text-green-500 font-medium">of {totalCP}</span>
                    </div>
                </div>

                {/* Active Plans Card */}
                <div className="bg-white rounded-lg shadow p-5">
                    <h3 className="text-gray-500 text-sm font-medium mb-2">Active Plans</h3>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <ProgressPieChart progress={progress} size={70} strokeWidth={8} />
                            <div>
                                <div className="text-2xl font-bold text-gray-800">{progress}%</div>
                                <div className="text-sm text-green-500 font-medium">Your Progress</div>
                            </div>
                        </div>
                        <div className="text-right">
                            <div className="text-sm text-gray-500">Credit Points</div>
                            <div className="text-lg font-semibold text-gray-700">{earnedCP}/{totalCP}</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Completed Courses Tree */}
            <div className="mb-6">
                <CompletedCoursesTree />
            </div>

            {/* Recent Activity and Plan Updates */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Recent Activity */}
                <div className="bg-white rounded-lg shadow p-5">
                    <div className="flex items-center mb-2">
                        <div className="w-10 h-10 bg-gradient-to-r from-yellow-400 to-yellow-600 rounded-md flex items-center justify-center mr-2">
                            <Sparkles className="w-5 h-5 text-white" />
                        </div>

                        <h2 className="text-xl font-semibold text-gray-700">Recent Activity</h2>
                    </div>

                    <p className="text-sm text-gray-500 mb-6">Stay updated with your progress</p>

                    <div className="space-y-4">
                        {activity.length === 0 && (
                            <div className="text-sm text-gray-500">No recent activity yet.</div>
                        )}
                        {activity.slice(0, 6).map(a => (
                            <div key={a.id} className="pb-3 border-b border-gray-200">
                                <h4 className="font-medium text-gray-700 mb-1">{a.message}</h4>
                                <p className="text-xs text-gray-400">{new Date(a.ts).toLocaleString()}</p>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Course Recommendations */}
                <div className="space-y-6">
                    <div className="bg-white rounded-lg shadow p-5">
                        <div className="flex items-center mb-4">
                            <div className="flex items-center gap-2">
                                <span className="inline-flex w-8 h-8 rounded-lg bg-amber-500/10 text-amber-600 items-center justify-center border border-amber-200">
                                    <Lightbulb className="w-5 h-5" />
                                </span>
                                <h2 className="text-xl font-semibold text-gray-700">Recommendations</h2>
                            </div>
                            <div className="ml-2">
                                <p className="text-sm text-slate-500">Suggested for your pathway</p>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4">
                        {recs.map((course) => (
                            <CourseCard
                                key={course.id}
                                course={course}
                                showAddButton={false}
                            />
                        ))}
                    </div>

                    <div className="bg-white rounded-lg shadow p-5">
                        <button onClick={onExploreCourses} className="w-full py-2 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 transition-colors">
                            Explore Courses
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
}