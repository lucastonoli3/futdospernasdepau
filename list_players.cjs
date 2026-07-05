const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const env = fs.readFileSync('.env.local', 'utf8');
const url = env.match(/VITE_SUPABASE_URL=(.*)/)[1].trim();
const key = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1].trim();
const supabase = createClient(url, key);

async function listPlayers() {
    const { data, error } = await supabase.from('players').select('id, nickname, goals, assists, moral_score');
    if (error) { console.error(error); return; }
    data.sort((a, b) => a.nickname.localeCompare(b.nickname));
    const lines = data.map(p => `${p.nickname.padEnd(20)} | ${p.id} | G:${p.goals} A:${p.assists} M:${p.moral_score}`);
    fs.writeFileSync('players_list.txt', lines.join('\n'), 'utf8');
    console.log('Written to players_list.txt');
}

listPlayers().catch(console.error);
