import { Course } from "../app/components/types";
import { getActivePlan } from "./storage";

export interface ValidationResult {
    isValid: boolean;
    warnings: string[];
    errors: string[];
}

/**
 * Check if a course can be added to the current plan
 * @param course Course to be added
 * @param targetTermId Target term ID (optional, defaults to first term)
 * @returns Validation result
 */
export function validateCourseAddition(
    course: Course,
    targetTermId?: string
): ValidationResult {
    const result: ValidationResult = {
        isValid: true,
        warnings: [],
        errors: []
    };

    try {
        const plan = getActivePlan();
        if (!plan) {
            result.isValid = false;
            result.errors.push("No active plan found");
            return result;
        }

        // 1. Program matching check
        const normalize = (s: any) => String(s ?? '').trim().toLowerCase();
        const planProgram = normalize(plan.profile?.program);
        const courseProgram = normalize(course.program);

        if (planProgram && courseProgram &&
            courseProgram !== planProgram &&
            courseProgram !== normalize('All Programs')) {
            result.isValid = false;
            result.errors.push(`This course belongs to a different program (${course.program}). Your current program is ${plan.profile.program}.`);
        }

        // 2. Prerequisites check
        const completedCodes = new Set(plan.completedCodes || []);
        const prerequisites = (course.prerequisites || []).map(s => String(s).trim());

        if (prerequisites.length > 0) {
            const missing = prerequisites.filter(code => !completedCodes.has(code));
            if (missing.length > 0) {
                result.isValid = false;
                result.errors.push(`Prerequisites not met for ${course.code}. Required: ${missing.join(', ')}`);
            }
        }

        // 3. Credit point limit check (warning, doesn't prevent addition)
        if (plan.planner?.terms) {
            const term = targetTermId
                ? plan.planner.terms.find(t => t.id === targetTermId)
                : plan.planner.terms[0];

            if (term) {
                // Here we need to get course data to calculate total credits
                // Since we don't have direct access to coursesById, this check will be performed by the caller
                result.warnings.push(`Note: Adding this course may affect credit point limits for ${term.title}`);
            }
        }

        return result;
    } catch (error) {
        result.isValid = false;
        result.errors.push(`Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        return result;
    }
}

/**
 * Check if course is already in plan
 * @param courseId Course ID
 * @returns Whether it already exists
 */
export function isCourseAlreadyInPlan(courseId: number): boolean {
    try {
        const plan = getActivePlan();
        if (!plan?.planner?.terms) return false;

        return plan.planner.terms.some(term =>
            term.courseIds?.includes(courseId)
        );
    } catch {
        return false;
    }
}

/**
 * Get course location information in plan
 * @param courseId Course ID
 * @returns Course location information
 */
export function getCoursePlanInfo(courseId: number): {
    isInPlan: boolean;
    termTitle?: string;
    termId?: string
} {
    try {
        const plan = getActivePlan();
        if (!plan?.planner?.terms) {
            return { isInPlan: false };
        }

        for (const term of plan.planner.terms) {
            if (term.courseIds?.includes(courseId)) {
                return {
                    isInPlan: true,
                    termTitle: term.title,
                    termId: term.id
                };
            }
        }

        return { isInPlan: false };
    } catch {
        return { isInPlan: false };
    }
}
