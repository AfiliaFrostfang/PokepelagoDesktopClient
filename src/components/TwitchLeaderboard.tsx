import React from 'react';
import { Trophy, Clock, AlertTriangle, LogIn } from 'lucide-react';
import { useTwitch, type GuessFeedEntry } from '../context/TwitchContext';
import { useTwitchAuthStatus } from '../hooks/useTwitchAuthStatus';
import { getTwitchAuthUrl } from '../services/twitchAuthService';

const FeedEntry: React.FC<{ entry: GuessFeedEntry }> = ({ entry }) => {
    const timeAgo = getTimeAgo(entry.timestamp);
    return (
        <div className="flex items-center gap-2 text-xs py-1 px-2 rounded hover:bg-gray-800/50">
            <span className={entry.type === 'recaught' ? 'text-yellow-400' : 'text-green-400'}>
                {entry.type === 'recaught' ? '↩' : '✓'}
            </span>
            <span className="text-gray-200 font-medium truncate flex-1">{entry.pokemonName}</span>
            <span className="text-purple-400 truncate max-w-[100px]">
                {entry.username ? `@${entry.username}` : 'You'}
            </span>
            <span className="text-gray-600 text-[10px] shrink-0">{timeAgo}</span>
        </div>
    );
};

function getTimeAgo(timestamp: number): string {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return 'now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
    return `${Math.floor(seconds / 86400)}d`;
}

const ReauthNotice: React.FC = () => (
    <div className="shrink-0 m-2 p-3 rounded-lg bg-amber-900/10 border border-amber-700/30">
        <div className="flex items-start gap-2">
            <AlertTriangle size={14} className="text-amber-400 shrink-0 mt-0.5" />
            <div className="min-w-0">
                <div className="text-xs font-bold text-amber-300">Twitch sign-in expired, reconnect</div>
                <div className="text-[9px] text-gray-500">Guesses still count, but the bot cannot post confirmations until you sign in again.</div>
            </div>
        </div>
        <button
            onClick={() => { window.location.href = getTwitchAuthUrl(); }}
            className="mt-2 w-full flex items-center justify-center gap-2 py-2 bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/30 hover:border-purple-500/50 rounded-lg text-xs font-bold transition-all"
        >
            <LogIn size={14} />
            Reconnect Twitch Account
        </button>
    </div>
);

export const TwitchLeaderboard: React.FC = () => {
    const { leaderboard, guessFeed } = useTwitch();
    const { needsReauth } = useTwitchAuthStatus();

    const sorted = React.useMemo(() =>
        Array.from(leaderboard.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10),
        [leaderboard]
    );

    const isEmpty = sorted.length === 0 && guessFeed.length === 0;

    if (isEmpty) {
        return (
            <div className="flex flex-col h-full overflow-y-auto">
                {needsReauth && <ReauthNotice />}
                <div className="flex flex-col items-center justify-center flex-1 text-gray-500 text-sm px-6 py-12 text-center">
                    <Trophy size={28} className="mb-3 text-gray-600" />
                    <p className="font-medium text-gray-400">No guesses yet</p>
                    <p className="text-xs mt-1">Twitch chat guesses and manual guesses will appear here.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full overflow-hidden">
            {needsReauth && <ReauthNotice />}
            {/* Leaderboard */}
            {sorted.length > 0 && (
                <div className="shrink-0 border-b border-gray-800 pb-2">
                    <div className="flex items-center gap-2 px-3 py-2">
                        <Trophy size={14} className="text-purple-400" />
                        <span className="text-xs font-bold text-purple-400 uppercase tracking-wider">Leaderboard</span>
                    </div>
                    <div className="px-2">
                        {sorted.map(([username, count], i) => (
                            <div key={username} className="flex items-center gap-2 text-xs py-1 px-2 rounded hover:bg-gray-800/50">
                                <span className={`w-5 text-right font-bold ${i === 0 ? 'text-yellow-400' : i === 1 ? 'text-gray-300' : i === 2 ? 'text-amber-600' : 'text-gray-500'}`}>
                                    {i + 1}.
                                </span>
                                <span className="text-purple-300 font-medium truncate flex-1">@{username}</span>
                                <span className="text-gray-400 font-mono">{count}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Recent Guesses Feed */}
            {guessFeed.length > 0 && (
                <div className="flex-1 overflow-y-auto min-h-0">
                    <div className="flex items-center gap-2 px-3 py-2">
                        <Clock size={14} className="text-gray-400" />
                        <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Recent Guesses</span>
                    </div>
                    <div className="px-1">
                        {guessFeed.map(entry => (
                            <FeedEntry key={entry.id} entry={entry} />
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};
