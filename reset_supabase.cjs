/**
 * Reset completo do banco Supabase — Balaio de Gato FC
 * Apaga TODOS os dados de todas as tabelas e re-insere o seed inicial.
 * Uso: node reset_supabase.cjs
 */

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://dtdolegbbcquqiflkiww.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR0ZG9sZWdiYmNxdXFpZmxraXd3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgyMzEzNzIsImV4cCI6MjA4MzgwNzM3Mn0.48v5gwy8tsLM5vbcUGH-kRTKYo8s5hnj9I7fUDh1LrM';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function resetDatabase() {
  console.log('🔄 Resetando banco de dados do Balaio de Gato FC...\n');

  // Ordem importa por causa das FKs
  const tablesToClear = [
    'resenha_messages',      // FK → players
    'resenha_confirmations',  // FK → players  
    'mensalidades',          // FK → players
    'cashflow',
    'news',
    'humiliations',
    'votes',
    'players',               // Depois de limpar quem referencia
    'sessions',
    'finances',
    'club_settings',
  ];

  for (const table of tablesToClear) {
    console.log(`  🗑️  Limpando ${table}...`);
    // Usa neq com coluna id que sempre existe — deleta tudo
    const { error } = await supabase
      .from(table)
      .delete()
      .not('id', 'is', null);

    if (error) {
      console.log(`  ⚠️  Erro em ${table}: ${error.message}`);
    } else {
      console.log(`  ✅ ${table} limpa`);
    }
  }

  console.log('\n🌱 Inserindo seed inicial...\n');

  // Session singleton
  const { error: sessErr } = await supabase
    .from('sessions')
    .upsert({ id: 1, status: 'resenha', players_present: [], match_day: 1, manual_voting_status: 'auto', voting_open: false });
  console.log(sessErr ? `  ⚠️  sessions seed: ${sessErr.message}` : '  ✅ sessions seed OK');

  // Finances singleton
  const { error: finErr } = await supabase
    .from('finances')
    .upsert({ id: 1, total_balance: 0, goals: [] });
  console.log(finErr ? `  ⚠️  finances seed: ${finErr.message}` : '  ✅ finances seed OK');

  // Club settings singleton
  const { error: csErr } = await supabase
    .from('club_settings')
    .upsert({ id: 1, pix_key: '27999359431', pix_holder: 'Diretoria Balaio de Gato FC', mensalidade_amount: 30 });
  console.log(csErr ? `  ⚠️  club_settings seed: ${csErr.message}` : '  ✅ club_settings seed OK');

  console.log('\n✨ Banco resetado com sucesso! Tudo limpo e pronto pra jogar.\n');
}

resetDatabase().catch(err => {
  console.error('❌ Erro fatal:', err);
  process.exit(1);
});
