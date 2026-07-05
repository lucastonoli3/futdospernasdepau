/// <reference types="vite/client" />
import OpenAI from "openai";

const SYSTEM_INSTRUCTION = `Você é o narrador oficial do BALAIO DE GATO FC, um time de futebol de campo de Cariacica-ES, famoso pela resenha e pela amizade.
SEU ESTILO:
- Bem-humorado, descontraído, com gíria leve de futebol de campo e resenha de amigos.
- Pode zoar de leve quem jogou mal e exaltar quem foi bem, sempre na brincadeira saudável.
- NADA de palavrão pesado, ofensa de verdade, racismo, xenofobia, drogas ou violência. É zoeira de vestiário, não humilhação.
- Trate os jogadores como "sócios", "parceiros", "fera", "craque", "monstro".
- Use o universo do clube: gato/balaio, campo, gol de placa, caneta, chapéu, resenha, churrasco, mensalidade.
- Tom carismático de comentarista de pelada de campo que ama o clube. Curto e divertido.`;

const getOpenAIClient = () => {
  return new OpenAI({
    apiKey: import.meta.env.VITE_OPENAI_API_KEY || "",
    dangerouslyAllowBrowser: true // Necessário para Vite
  });
};

export const aiService = {
  async generateBestPlayerText(name: string, position: string, stats: string) {
    const openai = getOpenAIClient();
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: SYSTEM_INSTRUCTION },
        {
          role: "user", content: `Gere uma exaltação animada e exagerada para o CRAQUE DA RODADA do Balaio de Gato FC.
          Sócio: ${name}
          Posição: ${position}
          O que fez: ${stats}
          Regras: Max 3 frases, gíria leve de resenha, chame de fera/monstro/diferenciado.` }
      ]
    });
    return response.choices[0].message.content || "";
  },

  async generateWorstPlayerText(name: string, errors: string) {
    const openai = getOpenAIClient();
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: SYSTEM_INSTRUCTION },
        {
          role: "user", content: `Zoe de leve, na brincadeira, o que jogou MENOS NA RODADA do Balaio.
          Sócio: ${name}
          Vacilos: ${errors}
          Regras: Max 2 frases, zoeira leve de vestiário, sem ofensa pesada. Tipo "deixou a perna esquerda em casa".` }
      ]
    });
    return response.choices[0].message.content || "";
  },

  async generateGoalieComment(name: string, situation: 'fechou_o_gol' | 'frangou' | 'salvou_time') {
    const openai = getOpenAIClient();
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: SYSTEM_INSTRUCTION },
        { role: "user", content: `Comente o goleiro ${name}. Situação: ${situation}. Seja curto e grosso.` }
      ]
    });
    return response.choices[0].message.content || "";
  },

  async generateTeamDrawComment(teamA: string[], teamB: string[], teamC: string[], teamD?: string[]) {
    const openai = getOpenAIClient();
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: SYSTEM_INSTRUCTION },
        {
          role: "user", content: `Narre o sorteio dos times do Balaio de Gato FC com bom humor.
          Time A: ${teamA.join(', ')}
          Time B: ${teamB.join(', ')}
          Time C: ${teamC.join(', ')}
          ${teamD ? `Time D: ${teamD.join(', ')}` : ''}
          Aponte de leve qual time saiu mais forte, qual é o azarão e brinque com a resenha. Sem ofensa pesada.` }
      ]
    });
    return response.choices[0].message.content || "";
  },

  async generateBadgeUnlock(name: string, badgeName: string) {
    const openai = getOpenAIClient();
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: SYSTEM_INSTRUCTION },
        { role: "user", content: `O sócio ${name} desbloqueou a conquista: ${badgeName}. Comemore com bom humor e zoeira leve.` }
      ]
    });
    return response.choices[0].message.content || "";
  },

  async generateResenhaResponse(userMessage: string, userName: string) {
    const openai = getOpenAIClient();
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: SYSTEM_INSTRUCTION },
        { role: "user", content: `O sócio ${userName} falou na resenha: "${userMessage}". Responda na hora, com zoeira leve e bom humor do clube.` }
      ]
    });
    return response.choices[0].message.content || "";
  },

  async generatePlayerReply(targetMessage: string, authorName: string, responderName: string, responderStats: string) {
    const openai = getOpenAIClient();
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "Aja como um participante do grupo do Balaio de Gato FC. Informal e brincalhão, sem ofensa pesada." },
        {
          role: "user", content: `Você está interpretando o jogador "${responderName}" do Balaio de Gato FC.
          Seus dados: ${responderStats}.

          Situação: O sócio "${authorName}" mandou no grupo: "${targetMessage}".

          Tarefa: Responda essa mensagem COMO SE FOSSE O ${responderName}.
          Estilo: Curto, informal, abreviações de WhatsApp (tipo "tlgd", "kkk"), zoeira leve e amigável.
          Se você for goleiro e tomou gol, se defenda na brincadeira. Sem palavrão pesado.
          NÃO ASSINE A MENSAGEM. SÓ O TEXTO.` }
      ]
    });
    return response.choices[0].message.content || "";
  },

  async validateFaceInImage(base64Image: string): Promise<boolean> {
    const openai = getOpenAIClient();
    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: "Analise esta imagem. Ela contem claramente um rosto humano visível? Responda APENAS com a palavra 'SIM' ou 'NAO'. Sem explicações." },
              {
                type: "image_url",
                image_url: {
                  url: base64Image.startsWith('data:') ? base64Image : `data:image/jpeg;base64,${base64Image}`,
                },
              },
            ],
          },
        ],
      });
      const text = (response.choices[0].message.content || "").trim().toUpperCase();
      return text.includes('SIM');
    } catch (e) {
      console.error("Erro na validação de face:", e);
      return true; // Fallback
    }
  },

  async generatePlayerDossier(name: string, stats: string, moralScore: number, manualEvents?: string) {
    const openai = getOpenAIClient();
    const isHero = moralScore > 75;
    const task = isHero
      ? `Escreva um parágrafo de exaltação. O sócio é craque. Chame de gênio, ídolo, diferenciado. Tom de admiração e carinho pelo clube.`
      : `Escreva um parágrafo de "dossiê" comentando o estilo de jogo dele com zoeira leve e bem-humorada, sem ofensa pesada.`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: SYSTEM_INSTRUCTION },
        {
          role: "user", content: `Analise o sócio ${name} do Balaio de Gato FC.
          Estatísticas: ${stats}
          Contexto de momentos memoráveis da rodada: ${manualEvents || 'Nada marcante registrado ainda.'}
          Tarefa: ${task}
          Máximo 40 palavras.` }
      ]
    });
    return response.choices[0].message.content || "";
  }
};
