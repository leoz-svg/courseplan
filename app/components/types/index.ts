export interface Course {
    id: number;
    code: string;
    name: string;
    faculty: string;
    credits: number;
    level: 'Undergraduate' | 'Postgraduate' | string;
    program?: string;
    description?: string;
    prerequisites?: string[];
    corequisites?: string[];
    recommended?: boolean;
}

export interface NavItem {
    id: string;
    label: string;
    icon?: React.ComponentType<any>;
}