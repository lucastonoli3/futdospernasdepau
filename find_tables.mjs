
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const env = fs.readFileSync('.env.local', 'utf8');
const urlMatch = env.match(/VITE_SUPABASE_URL=(.*)/);
const keyMatch = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/);

const url = urlMatch[1].trim();
const key = keyMatch[1].trim();

const supabase = createClient(url, key);

async function findTable() {
    const list = ['finances', 'sessions', 'players', 'humiliations', 'heritage', 'chats'];
    const results = [];
    for (const t of list) {
        console.log(`Trying ${t}...`);
        const { data, error } = await supabase.from(t).select('*').limit(1);
        results.push({ table: t, found: !error, error: error ? error.message : null, data: data });
    }
    fs.writeFileSync('results.json', JSON.stringify(results, null, 2));
    console.log("Results written to results.json");
}
findTable();
