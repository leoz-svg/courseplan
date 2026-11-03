'use client';
import { List, Network, Share2, Search } from 'lucide-react';

export default function ExplorerHeader({
    view,
    onChangeView,
    search,
    onSearch,
}: {
    view: 'network' | 'list';
    onChangeView: (v: 'network' | 'list') => void;
    search: string;
    onSearch: (v: string) => void;
}) {
    const ToggleBtn = ({
        active,
        icon: Icon,
        label,
        onClick,
    }: {
        active: boolean;
        icon: any;
        label: string;
        onClick: () => void;
    }) => (
        <button
            className={
                'inline-flex items-center gap-2 rounded-xl px-3 py-2 border transition-colors ' +
                (active
                    ? 'bg-indigo-500/10 border-indigo-400 text-indigo-200'
                    : 'bg-slate-800/60 border-slate-700 text-slate-300 hover:bg-slate-800')
            }
            onClick={onClick}
            type="button"
        >
            <Icon className="w-4 h-4" />
            <span className="text-sm">{label}</span>
        </button>
    );

    return (
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="flex items-center gap-3">
                <ToggleBtn
                    active={view === 'list'}
                    icon={List}
                    label="List"
                    onClick={() => onChangeView('list')}
                />
                <ToggleBtn
                    active={view === 'network'}
                    icon={Network}
                    label="Network"
                    onClick={() => onChangeView('network')}
                />
            </div>

            <div className="flex-1 flex items-center gap-3">
                <div className="relative flex-1">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                        value={search}
                        onChange={(e) => onSearch(e.target.value)}
                        placeholder="Search by code, name, faculty..."
                        className="pl-9 h-10 w-full bg-slate-800 border border-slate-700 text-slate-100 placeholder:text-slate-500 rounded-xl outline-none focus:ring-2 focus:ring-indigo-300"
                    />
                </div>
                <button
                    type="button"
                    className="h-10 inline-flex items-center gap-2 rounded-xl px-3 border bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-800/80"
                    onClick={() => navigator?.share?.({ title: 'UTS Course Explorer', url: location?.href }).catch(() => { })}
                >
                    <Share2 className="w-4 h-4" /> Share
                </button>
            </div>
        </div>
    );
}
