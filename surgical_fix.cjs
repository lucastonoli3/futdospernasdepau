
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const env = fs.readFileSync('.env.local', 'utf8');
const url = env.match(/VITE_SUPABASE_URL=(.*)/)[1].trim();
const key = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1].trim();

const supabase = createClient(url, key);

const correctionData = [
    { nickname: 'Mr', goalsSub: 6, assistsSub: 0 },
    { nickname: 'WC', goalsSub: 3, assistsSub: 0 },
    { nickname: 'Celsin', goalsSub: 3, assistsSub: 0 },
    { nickname: 'Guu', goalsSub: 2, assistsSub: 0 },
    { nickname: 'luizhenrique', goalsSub: 2, assistsSub: 0 },
    { nickname: 'Jv', goalsSub: 1, assistsSub: 0 },
    { nickname: 'L.C', goalsSub: 0, assistsSub: 3 },
    { nickname: 'Tonoli', goalsSub: 0, assistsSub: 3 },
    { nickname: 'Ptk', goalsSub: 0, assistsSub: 2 }
];

async function applyCorrection() {
    console.log('Starting statistical correction...');

    for (const item of correctionData) {
        const { data: player, error: fetchError } = await supabase
            .from('players')
            .select('*')
            .eq('nickname', item.nickname)
            .single();

        if (fetchError || !player) {
            console.error(`Error fetching player ${item.nickname}:`, fetchError?.message || 'Not found');
            continue;
        }

        // 1. Correct stats
        const newGoals = Math.max(0, (player.goals || 0) - item.goalsSub);
        const newAssists = Math.max(0, (player.assists || 0) - item.assistsSub);

        // 2. Repair badges (handle recursive stringification and corruption)
        let b = player.badges;
        let iterations = 0;
        while (typeof b === 'string' && iterations < 5) {
            try {
                let next = JSON.parse(b);
                b = next;
                iterations++;
            } catch (e) { break; }
        }

        if (!Array.isArray(b)) b = [];
        b = b.filter(x => typeof x === 'string' && x.length > 2 && !['[', ']', '\"', '\\\"'].includes(x));
        b = [...new Set(b)];

        const { error: updateError } = await supabase
            .from('players')
            .update({
                goals: newGoals,
                assists: newAssists,
                badges: JSON.stringify(b)
            })
            .eq('id', player.id);

        if (updateError) {
            console.error(`Error updating player ${item.nickname}:`, updateError.message);
        } else {
            console.log(`Successfully corrected ${item.nickname}: Goals -${item.goalsSub}, Assists -${item.assistsSub}`);
        }
    }

    // Double check all players for badge corruption
    const { data: allPlayers } = await supabase.from('players').select('id, nickname, badges');
    for (const p of allPlayers) {
        let b = p.badges;
        let iterations = 0;
        while (typeof b === 'string' && iterations < 5) {
            try {
                let next = JSON.parse(b);
                b = next;
                iterations++;
            } catch (e) { break; }
        }
        if (typeof p.badges === 'string' && p.badges.startsWith('\"') || !Array.isArray(b)) {
            if (!Array.isArray(b)) b = [];
            b = b.filter(x => typeof x === 'string' && x.length > 2 && !['[', ']', '\"', '\\\"'].includes(x));
            await supabase.from('players').update({ badges: JSON.stringify(b) }).eq('id', p.id);
            console.log(`Cleaned up corrupted badges for ${p.nickname}`);
        }
    }

    console.log('Correction process completed.');
}

applyCorrection().catch(console.error);
