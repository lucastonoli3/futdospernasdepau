
import { Badge, Player, PlayerStatus, Position } from './types';

export const ALL_BADGES: Badge[] = [
  // GERAIS
  { id: 'b1', name: 'Chegou Agora', icon: '👶', description: 'Acabou de brotar. Fica esperto pra não virar saudade.', category: 'Geral' },
  { id: 'b9', name: 'Sobrevivente', icon: '💀', description: 'Jogou a primeira sem vomitar nem apanhar.', category: 'Geral' },
  { id: 'b2', name: 'Sócio da Boca', icon: '🖐️', description: '5 peladas. Já deve dinheiro pra todo mundo.', category: 'Geral' },
  { id: 'b3', name: 'Procurado', icon: '🚔', description: 'Sumiu. Ou tá preso ou tá devendo pensão.', category: 'Geral' },
  { id: 'b4', name: 'Zumbi', icon: '🧟', description: 'Ressuscitou das cinzas cheio de cachaça.', category: 'Geral' },
  { id: 'b5', name: 'Pulmão de Filtro', icon: '🚬', description: 'Não corre 2 metros, só fica fumando na beira do campo.', category: 'Geral' },
  { id: 'b6', name: 'Perna de Pau', icon: '🪵', description: 'É ruim com força. Dá desgosto de ver.', category: 'Geral' },
  { id: 'b7', name: 'Dono da Várzea', icon: '👑', description: '100 jogos. O fígado já pediu demissão.', category: 'Geral' },
  { id: 'b8', name: 'Chorão', icon: '😭', description: 'Reclama de tudo. Acha que tá na Champions, seu lixo?', category: 'Geral' },

  // LINHA
  { id: 'l1', name: 'Fominha', icon: '🤬', description: 'Não toca a bola nem pra salvar a mãe.', category: 'Linha' },
  { id: 'l2', name: 'Garçom de Bêbado', icon: '🤵', description: 'Só dá passe se for pro adversário.', category: 'Linha' },
  { id: 'l3', name: 'Inacreditável', icon: '🤦', description: 'Errou gol sem goleiro. Merecia apanhar.', category: 'Linha' },
  { id: 'l4', name: 'Pé de Pantufa', icon: '🧸', description: 'Chuta igual uma criança de 5 anos.', category: 'Linha' },
  { id: 'l5', name: 'Caneleiro', icon: '🪓', description: 'Só bate. Se a bola passar, o jogador fica.', category: 'Linha' },
  { id: 'l6', name: 'Corre Errado', icon: '🏃', description: 'Parece uma barata tonta em campo.', category: 'Linha' },

  // GOLEIROS
  { id: 'g1', name: 'Paredão do Tráfico', icon: '🧱', description: 'Hoje a droga tava boa, pegou tudo.', category: 'Goleiro' },
  { id: 'g2', name: 'Mão de Quiabo', icon: '🥬', description: 'A bola escorrega. Parece que passou óleo na luva.', category: 'Goleiro' },
  { id: 'g3', name: 'Chama Gol', icon: '🐔', description: 'Todo chute é gol. Pode botar um cone no lugar.', category: 'Goleiro' },
  { id: 'g4', name: 'Goleiro Linha', icon: '🤡', description: 'Acha que sabe jogar com o pé e entrega a paçoca.', category: 'Goleiro' },

  // ELITE (OURO)
  { id: 'h1', name: 'Bola de Ouro', icon: '🏆', description: 'O melhor. Incompreendido por este bando de bagres.', category: 'Elite' },
  { id: 'h2', name: 'Artilheiro do Tráfico', icon: '🔫', description: 'Mata o jogo e não pede desculpa.', category: 'Elite' },
  { id: 'h3', name: 'Goleiro de Aluguel', icon: '🧤', description: 'Digno de ser pago pra jogar aqui. O único lúcido.', category: 'Elite' },

  // HONRA
  { id: 'f1', name: 'Fundador da Pelada', icon: '🏛️', description: 'Um dos pais desta biqueira esportiva. Respeite ou vaza.', category: 'Honra' },

  // SECRETO / SISTEMA
  { id: 'dev1', name: 'Mago do Código', icon: '🧙‍♂️', description: 'O mago que fez essa porra toda, o magico da programação', category: 'Architect' },
];

export const MOCK_PLAYERS: Player[] = []; // Removido. Tudo vem do Supabase agora.
