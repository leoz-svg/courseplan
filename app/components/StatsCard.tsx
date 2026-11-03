interface StatsCardProps {
    title: string;
    value: string | number;
    subtitle: string;
    color?: string;
}

export default function StatsCard({ title, value, subtitle, color = 'blue' }: StatsCardProps) {
    const colorClasses = {
        blue: 'bg-blue-500',
        green: 'bg-green-500',
        purple: 'bg-purple-500',
        orange: 'bg-orange-500'
    };

    return (
        <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
            <div className="flex items-center">
                <div className={`w-4 h-4 ${colorClasses[color as keyof typeof colorClasses]} rounded-full mr-3`}></div>
                <h3 className="text-gray-500 text-sm font-medium">{title}</h3>
            </div>
            <div className="mt-2">
                <span className="text-2xl font-bold text-gray-800">{value}</span>
                <p className="text-sm text-gray-600 mt-1">{subtitle}</p>
            </div>
        </div>
    );
}