export type PlannerState = { terms: { id: string; title: string; limitCP: number; courseIds: number[] }[] };
export type PlanActivity = {
    id: string;
    ts: number;
    message: string;
};

export type Plan = {
    id: string;
    name: string;
    profile: { program: string; entryYear: string; studentId?: string };
    completedCodes: string[];
    planner?: PlannerState;
    activity?: PlanActivity[];
    createdAt: number;
    updatedAt: number;
};

const PLANS_KEY = 'plans';
const ACTIVE_KEY = 'active-plan-id';

export function getPlans(): Plan[] {
    if (typeof window === 'undefined') return [];
    try { return JSON.parse(localStorage.getItem(PLANS_KEY) || '[]'); } catch { return []; }
}

export function savePlans(plans: Plan[]) {
    if (typeof window === 'undefined') return;
    localStorage.setItem(PLANS_KEY, JSON.stringify(plans));
}

export function getActivePlanId(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(ACTIVE_KEY);
}

export function setActivePlanId(id: string) {
    if (typeof window === 'undefined') return;
    localStorage.setItem(ACTIVE_KEY, id);
}

export function getActivePlan(): Plan | null {
    const id = getActivePlanId();
    if (!id) return null;
    const plan = getPlans().find(p => p.id === id);
    return plan ? ensurePlanInitialized(plan) : null;
}

export function getOrSetActivePlan(): Plan | null {
    const current = getActivePlan();
    if (current) return current;
    const plans = getPlans();
    if (!plans.length) return null;
    const latest = plans.slice().sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))[0];
    if (latest && typeof window !== 'undefined') setActivePlanId(latest.id);
    return latest ? ensurePlanInitialized(latest) : null;
}

export function upsertPlan(plan: Plan) {
    const plans = getPlans();
    const idx = plans.findIndex(p => p.id === plan.id);
    if (idx >= 0) plans[idx] = plan; else plans.push(plan);
    savePlans(plans);
}

export function deletePlan(id: string) {
    const plans = getPlans().filter(p => p.id !== id);
    savePlans(plans);
    const active = getActivePlanId();
    if (typeof window !== 'undefined' && active === id) localStorage.removeItem(ACTIVE_KEY);
}

// ==================== 👇 Below are the newly added parts ====================

/** Ensure plan's basic fields are properly initialized */
export function ensurePlanInitialized(plan: Plan): Plan {
    // Ensure completedCodes is an array
    if (!Array.isArray(plan.completedCodes)) {
        plan.completedCodes = [];
    }

    // Ensure activity is an array
    if (!Array.isArray(plan.activity)) {
        plan.activity = [];
    }

    return plan;
}

/** Ensure planner exists; if not, create a default term */
export function ensurePlannerInitialized(plan: Plan): { plan: Plan; termId: string } {
    if (!plan.planner || !Array.isArray(plan.planner.terms) || plan.planner.terms.length === 0) {
        plan.planner = {
            terms: [
                {
                    id: 'term-1',
                    title: 'Term 1',
                    limitCP: 24,
                    courseIds: [],
                },
            ],
        };
    }
    const first = plan.planner.terms[0];
    return { plan, termId: first.id };
}

/** Record plan activity (timeline) */
export function appendActivity(plan: Plan, message: string) {
    const now = Date.now();
    const item: PlanActivity = { id: `act-${now}`, ts: now, message };
    if (!Array.isArray(plan.activity)) plan.activity = [];
    plan.activity.unshift(item);
}

/**
 * Add course ID (numeric) to specified term of "currently active plan"
 * @param courseId Numeric id of course in your course table (not code)
 * @param opts.termId Optional, defaults to first term if not provided
 */
export function addCourseIdToActivePlan(courseId: number, opts?: { termId?: string }) {
    const plan = getOrSetActivePlan();
    if (!plan) throw new Error('No active plan');

    const { termId } = ensurePlannerInitialized(plan);
    const targetTermId = opts?.termId ?? termId;

    const term = plan.planner!.terms.find(t => t.id === targetTermId);
    if (!term) throw new Error(`Term not found: ${targetTermId}`);

    if (!Array.isArray(term.courseIds)) term.courseIds = [];
    const exists = term.courseIds.includes(courseId);
    if (!exists) {
        term.courseIds.push(courseId);
        appendActivity(plan, `Added course #${courseId} to ${term.title}`);
    }

    plan.updatedAt = Date.now();
    upsertPlan(plan);

    // Notify UI (your page.tsx is listening for 'plan-changed')
    if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('plan-changed', { detail: { planId: plan.id } }));
    }
}

/**
 * Add completed course to current active plan
 * @param courseCode Course code (e.g., "48023")
 */
export function addCompletedCourse(courseCode: string) {
    const plan = getOrSetActivePlan();
    if (!plan) throw new Error('No active plan');

    // ensurePlanInitialized has already ensured completedCodes is an array
    if (!plan.completedCodes.includes(courseCode)) {
        plan.completedCodes.push(courseCode);
        appendActivity(plan, `Completed course ${courseCode}`);
        plan.updatedAt = Date.now();
        upsertPlan(plan);

        // Notify UI
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('plan-changed', { detail: { planId: plan.id } }));
        }
    }
}

/**
 * Remove completed course
 * @param courseCode Course code
 */
export function removeCompletedCourse(courseCode: string) {
    const plan = getOrSetActivePlan();
    if (!plan) return;

    if (Array.isArray(plan.completedCodes)) {
        const index = plan.completedCodes.indexOf(courseCode);
        if (index > -1) {
            plan.completedCodes.splice(index, 1);
            appendActivity(plan, `Removed completed course ${courseCode}`);
            plan.updatedAt = Date.now();
            upsertPlan(plan);

            // Notify UI
            if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('plan-changed', { detail: { planId: plan.id } }));
            }
        }
    }
}



