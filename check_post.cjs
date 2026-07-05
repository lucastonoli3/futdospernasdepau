const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf8');
const url = env.match(/VITE_SUPABASE_URL=(.*)/)[1].trim();
const key = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1].trim();
const s = createClient(url, key);

const ids = [
    'd9344c3b-2728-4e0f-8bf3-fec27b73c516', // Tonoli
    '112b2bc1-eef6-4ec6-b5e8-90f243e3b271', // Celsin
    'e87ed5eb-af93-4a84-aab9-2cc0e6187da6', // Cleitim
    '28465778-2f53-43c8-98ee-471506dbc3eb', // Micael
    'cb431014-9794-4d58-a698-4815ab2d2749', // Semente
    '6a4895b8-3c03-4f6d-923c-4785b869ca0b', // WC
    '1cd4d857-b544-407b-81b0-3540ec14c758', // JV
    '1bf31bdc-723d-4849-b9b2-5a6622b790df', // Max
    '5c2099dd-fc10-4fdc-9dcc-72216decc17e', // Guu
    '14330fae-4d33-470e-ab00-9bd9acf42564', // PH/Bin
    '21b47f15-8e6f-429d-a85c-61b1d73e8de7', // Jota
];

(async () => {
    const { data } = await s.from('players').select('nickname, goals, assists, moral_score').in('id', ids);
    data.sort((a, b) => a.nickname.localeCompare(b.nickname));
    const lines = data.map(p => `${p.nickname.padEnd(15)} G:${p.goals} A:${p.assists} M:${p.moral_score}`);
    fs.writeFileSync('post_update.txt', lines.join('\n'));
    console.log('Done - check post_update.txt');
})();
