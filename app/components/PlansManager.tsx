'use client';

import { useEffect, useState } from 'react';
import { nanoid } from 'nanoid';
import { Plan, getPlans, savePlans, getActivePlanId, setActivePlanId, deletePlan } from '../../lib/storage';

export default function PlansManager({ onClose }: { onClose: () => void }) {
    const [plans, setPlans] = useState<Plan[]>([]);
    const [activeId, setActiveIdState] = useState<string | null>(null);
    const [newName, setNewName] = useState('New Study Plan');

    useEffect(() => {
        setPlans(getPlans());
        setActiveIdState(getActivePlanId());
    }, []);

    function createPlan() {
        const plan: Plan = {
            id: nanoid(),
            name: newName || 'Untitled Plan',
            profile: { program: 'Bachelor of Engineering (Software)', entryYear: String(new Date().getFullYear()) },
            completedCodes: [],
            planner: undefined,
            createdAt: Date.now(),
            updatedAt: Date.now(),
        };
        const next = [...plans, plan];
        savePlans(next);
        setPlans(next);
        setActivePlanId(plan.id);
        setActiveIdState(plan.id);
        // Immediately open onboarding for the new plan
        localStorage.setItem('onboarding-plan-id', plan.id);
        location.reload();
    }

    function renamePlan(id: string, name: string) {
        const next = plans.map(p => p.id === id ? { ...p, name, updatedAt: Date.now() } : p);
        savePlans(next);
        setPlans(next);
    }

    function removePlan(id: string) {
        deletePlan(id);
        setPlans(getPlans());
        setActiveIdState(getActivePlanId());
        // Trigger plan-changed event to notify other components to update
        window.dispatchEvent(new CustomEvent('plan-changed'));
    }

    function setActive(id: string) {
        setActivePlanId(id);
        setActiveIdState(id);
        window.dispatchEvent(new CustomEvent('plan-changed'));
    }

    return (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center p-4 z-50">
            <div className="w-full max-w-2xl bg-white rounded-2xl shadow-xl p-6">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-bold text-slate-900">Manage Study Plans</h2>
                    <button onClick={onClose} className="text-slate-600 hover:text-slate-900">Close</button>
                </div>

                <div className="mb-4 flex gap-2">
                    <input value={newName} onChange={(e) => setNewName(e.target.value)} className="flex-1 h-10 rounded-xl border border-slate-300 px-3 text-black placeholder:text-slate-500" placeholder="Plan name" />
                    <button onClick={createPlan} className="px-4 h-10 rounded-xl bg-indigo-600 text-white font-medium">Create</button>
                </div>

                <div className="space-y-3 max-h-[50vh] overflow-auto pr-2">
                    {plans.map(p => (
                        <div key={p.id} className={`rounded-xl border p-4 flex items-center justify-between ${activeId === p.id ? 'border-indigo-400 bg-indigo-50' : 'border-slate-200 bg-white'}`}>
                            <div className="min-w-0">
                                <input
                                    value={p.name}
                                    onChange={(e) => renamePlan(p.id, e.target.value)}
                                    className="font-semibold text-black bg-transparent outline-none"
                                />
                                <div className="text-xs text-slate-500">{new Date(p.updatedAt).toLocaleString()}</div>
                            </div>
                            <div className="flex items-center gap-2">
                                <button onClick={() => setActive(p.id)} className={`px-3 h-9 rounded-lg text-sm ${activeId === p.id ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>{activeId === p.id ? 'Active' : 'Set Active'}</button>
                                <button onClick={() => { localStorage.setItem('onboarding-plan-id', p.id); location.reload(); }} className="px-3 h-9 rounded-lg text-sm bg-blue-100 text-blue-700 hover:bg-blue-200">Edit</button>
                                <button onClick={() => removePlan(p.id)} className="px-3 h-9 rounded-lg text-sm bg-rose-100 text-rose-700 hover:bg-rose-200">Delete</button>
                            </div>
                        </div>
                    ))}
                    {!plans.length && <div className="text-slate-500 text-sm">No plans yet. Create one above.</div>}
                </div>
            </div>
        </div>
    );
}


