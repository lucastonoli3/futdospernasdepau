
import { supabase } from './supabaseClient';
import { Player } from '../types';

export const STATS_BADGE_MAP = {
    goals: [
        { threshold: 1, badgeId: 'g1a' },
        { threshold: 10, badgeId: 'g10' },
        { threshold: 50, badgeId: 'g50' },
        { threshold: 100, badgeId: 'g100' },
    ],
    assists: [
        { threshold: 1, badgeId: 'a1' },
        { threshold: 10, badgeId: 'a10' },
        { threshold: 50, badgeId: 'a50' },
    ],
    matchesPlayed: [
        { threshold: 1, badgeId: 'pres1' },
        { threshold: 5, badgeId: 'pres2' },
        { threshold: 10, badgeId: 'pres3' },
        { threshold: 20, badgeId: 'pres4' },
        { threshold: 50, badgeId: 'pres5' },
        { threshold: 100, badgeId: 'pres6' },
        { threshold: 200, badgeId: 'pres26' },
    ]
};

export const checkAndAssignBadges = async (player: Player) => {
    let newBadges = [...player.badges];
    let updated = false;

    // Check Goals
    for (const rule of STATS_BADGE_MAP.goals) {
        if (player.goals >= rule.threshold && !newBadges.includes(rule.badgeId)) {
            newBadges.push(rule.badgeId);
            updated = true;
        }
    }

    // Check Assists
    for (const rule of STATS_BADGE_MAP.assists) {
        if (player.assists >= rule.threshold && !newBadges.includes(rule.badgeId)) {
            newBadges.push(rule.badgeId);
            updated = true;
        }
    }

    // Check Matches Played
    for (const rule of STATS_BADGE_MAP.matchesPlayed) {
        if (player.matchesPlayed >= rule.threshold && !newBadges.includes(rule.badgeId)) {
            newBadges.push(rule.badgeId);
            updated = true;
        }
    }

    if (updated) {
        const { error } = await supabase
            .from('players')
            .update({ badges: newBadges })
            .eq('id', player.id);

        if (error) console.error("Erro ao atualizar medalhas automáticas:", error);
        return newBadges;
    }

    return null;
};
