// Cria/atualiza uma conta de TESTE no Balaio de Gato FC (com acesso de diretoria).
// Rode na sua máquina (com internet):  node create_test_user.cjs
const { createClient } = require('@supabase/supabase-js');

// Tenta carregar .env.local; se não tiver dotenv instalado, segue com fallback embutido.
try { require('dotenv').config({ path: '.env.local' }); } catch (e) { /* ok */ }

const url = process.env.VITE_SUPABASE_URL || 'https://dtdolegbbcquqiflkiww.supabase.co';
const key = process.env.VITE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR0ZG9sZWdiYmNxdXFpZmxraXd3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgyMzEzNzIsImV4cCI6MjA4MzgwNzM3Mn0.48v5gwy8tsLM5vbcUGH-kRTKYo8s5hnj9I7fUDh1LrM';

const supabase = createClient(url, key);

// >>> CREDENCIAIS DE TESTE <<<
const NICKNAME = 'Diretor';
const SENHA = 'balaio123';

const base = {
  name: 'Conta de Teste',
  nickname: NICKNAME,
  password: SENHA,
  photo: 'https://api.dicebear.com/7.x/thumbs/png?seed=balaio',
  position: 'Linha',
  invited_by: 'Sistema',
  matches_played: 0,
  goals: 0,
  assists: 0,
  best_votes: 0,
  worst_votes: 0,
  moral_score: 100,
  status: '😐 Normal',
  badges: JSON.stringify(['b1', 'leg2']),
  is_admin: true,
  is_paid: false,
  debt: 30,
};

(async () => {
  console.log('Conectando em', url, '...');

  const { data: existing, error: selErr } = await supabase
    .from('players').select('id').ilike('nickname', NICKNAME).maybeSingle();
  if (selErr) { console.error('Erro ao consultar players:', selErr.message); process.exit(1); }

  if (existing) {
    const { error } = await supabase.from('players')
      .update({ password: SENHA, is_admin: true }).eq('id', existing.id);
    if (error) { console.error('Erro ao atualizar:', error.message); process.exit(1); }
    console.log('Conta de teste ATUALIZADA.');
  } else {
    const { error } = await supabase.from('players').insert([base]);
    if (error) { console.error('Erro ao criar (veja a coluna citada):', error.message); process.exit(1); }
    console.log('Conta de teste CRIADA.');
  }

  // Verificação: simula exatamente o login do app
  const { data: check } = await supabase
    .from('players').select('nickname, password, is_admin').ilike('nickname', NICKNAME).maybeSingle();

  console.log('\n================ TESTE DE LOGIN ================');
  if (check && check.password === SENHA) {
    console.log('  LOGIN OK ✅');
    console.log('  Apelido: ' + check.nickname + '   (use exatamente assim)');
    console.log('  Senha:   ' + SENHA);
    console.log('  Diretoria: ' + (check.is_admin ? 'SIM' : 'não'));
  } else {
    console.log('  ALGO ERRADO ❌  — conta encontrada:', !!check);
  }
  console.log('===============================================\n');
})();
