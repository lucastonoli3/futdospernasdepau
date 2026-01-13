import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import { Player } from '../types';

interface Notification {
    id: string;
    type: 'like' | 'comment' | 'insult' | 'tag';
    content?: string;
    is_read: boolean;
    created_at: string;
    actor_id: string;
    heritage_id: string;
    players: {
        nickname: string;
        photo: string;
    };
}

interface NotificationCenterProps {
    currentUser: Player;
}

const NotificationCenter: React.FC<NotificationCenterProps> = ({ currentUser }) => {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);

    useEffect(() => {
        fetchNotifications();

        // Realtime subscription
        const channel = supabase
            .channel('realtime_notifications')
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'notifications',
                filter: `player_id=eq.${currentUser.id}`
            }, (payload) => {
                fetchNotifications();
                // Opcional: Play sound or toast
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [currentUser.id]);

    const fetchNotifications = async () => {
        const { data } = await supabase
            .from('notifications')
            .select('*, players:actor_id(nickname, photo)')
            .eq('player_id', currentUser.id)
            .order('created_at', { ascending: false })
            .limit(20);

        if (data) {
            setNotifications(data as any);
            setUnreadCount(data.filter(n => !n.is_read).length);
        }
    };

    const markAsRead = async () => {
        if (unreadCount === 0) return;
        await supabase
            .from('notifications')
            .update({ is_read: true })
            .eq('player_id', currentUser.id);

        setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
        setUnreadCount(0);
    };

    const getTypeLabel = (type: string) => {
        switch (type) {
            case 'like': return 'curtiu sua memória';
            case 'comment': return 'comentou na sua foto';
            case 'insult': return 'te deu um esculacho';
            case 'tag': return 'te marcou numa foto';
            default: return 'interagiu com você';
        }
    };

    return (
        <div className="relative">
            <button
                onClick={() => { setIsOpen(!isOpen); if (!isOpen) markAsRead(); }}
                className="relative p-2 hover:bg-neutral-800 rounded-full transition-all"
            >
                <span className="text-2xl">🔔</span>
                {unreadCount > 0 && (
                    <span className="absolute top-0 right-0 bg-red-600 text-[10px] font-black w-5 h-5 flex items-center justify-center rounded-full border-2 border-black animate-bounce">
                        {unreadCount}
                    </span>
                )}
            </button>

            {isOpen && (
                <div className="absolute right-0 mt-4 w-80 bg-neutral-900/95 backdrop-blur-xl border border-neutral-800 shadow-2xl z-[300] rounded-2xl overflow-hidden animate-in fade-in slide-in-from-top-2">
                    <div className="p-4 border-b border-neutral-800 flex justify-between items-baseline">
                        <h4 className="text-[10px] font-black text-neutral-500 uppercase tracking-widest">Atividade Recente</h4>
                        {unreadCount > 0 && <span className="text-[8px] bg-red-600 px-2 py-0.5 rounded-full font-black text-white">{unreadCount} NOVAS</span>}
                    </div>

                    <div className="max-h-96 overflow-y-auto no-scrollbar">
                        {notifications.length === 0 ? (
                            <div className="p-10 text-center text-neutral-600 text-[10px] font-mono uppercase italic">Nenhuma treta registrada.</div>
                        ) : (
                            notifications.map(n => (
                                <div key={n.id} className={`p-4 border-b border-neutral-800/50 flex gap-3 hover:bg-white/5 transition-all ${!n.is_read ? 'bg-red-950/5' : ''}`}>
                                    <img src={n.players?.photo} className="w-8 h-8 rounded-full object-cover shrink-0 grayscale hover:grayscale-0 transition-all" />
                                    <div className="flex-1 space-y-1">
                                        <p className="text-xs text-neutral-300 leading-tight">
                                            <span className="font-black text-white italic">@{n.players?.nickname}</span> {getTypeLabel(n.type)}
                                        </p>
                                        {n.content && <p className="text-[10px] text-neutral-500 italic line-clamp-1">"{n.content}"</p>}
                                        <p className="text-[8px] text-neutral-600 font-mono uppercase font-bold">{new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                                    </div>
                                    {!n.is_read && <div className="w-1.5 h-1.5 bg-red-600 rounded-full mt-2"></div>}
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default NotificationCenter;
