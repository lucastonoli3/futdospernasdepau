
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const env = fs.readFileSync('.env.local', 'utf8');
const url = env.match(/VITE_SUPABASE_URL=(.*)/)[1].trim();
const key = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1].trim();

const supabase = createClient(url, key);

async function findPlayers() {
    const nicknames = [
        'Gu', 'Celso', 'Celsin', 'Werley', 'JV', 'Luiz', 'Luiz Henrique',
        'Parnaiba', 'Parma', 'WC', 'Ptk', 'Pará', 'Para', 'Luciano', 'Brow'
    ];

    const { data, error } = await supabase.from('players').select('*');
    if (error) {
        console.error(error);
        return;
    }

    const found = data.filter(p =>
        nicknames.some(n => p.nickname?.toLowerCase() === n.toLowerCase())
    ).map(p => ({
        id: p.id,
        nickname: p.nickname,
        goals: p.goals,
        assists: p.assists,
        moral_score: p.moral_score,
        badges: typeof p.badges === 'string' ? JSON.parse(p.badges) : p.badges
    }));

    fs.writeFileSync('player_map.json', JSON.stringify(found, null, 2));
    console.log(`Found ${found.length} players. written to player_map.json`);
}

findPlayers();
