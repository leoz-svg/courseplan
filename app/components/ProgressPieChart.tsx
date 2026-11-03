'use client';

import React from 'react';

interface ProgressPieChartProps {
    progress: number; // 0-100
    size?: number;
    strokeWidth?: number;
    className?: string;
}

export default function ProgressPieChart({
    progress,
    size = 60,
    strokeWidth = 6,
    className = ''
}: ProgressPieChartProps) {
    const radius = (size - strokeWidth) / 2;
    const circumference = radius * 2 * Math.PI;
    const strokeDasharray = circumference;
    const strokeDashoffset = circumference - (progress / 100) * circumference;

    return (
        <div className={`relative inline-flex items-center justify-center ${className}`}>
            <svg
                width={size}
                height={size}
                className="transform -rotate-90"
            >
                {/* Background circle */}
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="none"
                    stroke="#e5e7eb"
                    strokeWidth={strokeWidth}
                />
                {/* Progress circle */}
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="none"
                    stroke="#10b981"
                    strokeWidth={strokeWidth}
                    strokeDasharray={strokeDasharray}
                    strokeDashoffset={strokeDashoffset}
                    strokeLinecap="round"
                    className="transition-all duration-1000 ease-in-out"
                    style={{
                        filter: 'drop-shadow(0 2px 4px rgba(16, 185, 129, 0.3))'
                    }}
                />
            </svg>
            {/* Center text */}
            <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-lg font-bold text-gray-800">
                    {Math.round(progress)}%
                </span>
            </div>
        </div>
    );
}


