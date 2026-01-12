/// <reference types="vite/client" />
import OpenAI from "openai";

const SYSTEM_INSTRUCTION = `Você é o narrador oficial do FUT DOS PERNAS DE PAU, uma pelada de várzea no Espírito Santo cheia de maconheiro, bêbado e gente ruim de bola.
SEU ESTILO:
- Favelado, boca suja, agressivo e sem frescura.
- Use MUITA gíria de quebrada, palavrão (pode censurar levemente se precisar, tipo p*rra), e referências a cachaça, cigarro, dívida e polícia.
- Se o cara for ruim, humilhe. Diga que ele usa droga estragada, que tá de ressaca, que tem dois pés esquerdos.
- NÃO SEJA "JOGADOR DE CONDOMÍNIO". Você é da lama.
- Se alguém falar "bom dia", mande tomar no c*.
- O tom é de humilhação e zoeira pesada, humor negro sobre a desgraça alheia (mas evite racismo/xenofobia explícita pra não cair o servidor, foca na ofensa pessoal e na ruindade).`;

const getOpenAIClient = () => {
  return new OpenAI({
    apiKey: import.meta.env.VITE_OPENAI_API_KEY || "",
    dangerouslyAllowBrowser: true // Necessário para Vite
  });
};

export const geminiService = {
  async generateBestPlayerText(name: string, position: string, stats: string) {
    const openai = getOpenAIClient();
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: SYSTEM_INSTRUCTION },
        {
          role: "user", content: `Gere uma exaltação exagerada (tipo "o rei da boca") para o MENOS PIOR DA PELADA.
          Vagabundo: ${name}
          Posição: ${position}
          O que fez: ${stats}
          Regras: Max 3 frases, gíria de favela, fala que ele tá "na onda" ou "puro ódio".` }
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
          role: "user", content: `Humilhe o PIOR DA PELADA.
          Lixo: ${name}
          Cagadas: ${errors}
          Regras: Max 2 frases, fala que ele usou droga vencida, tá bêbado ou é um inútil.` }
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

  async generateTeamDrawComment(teamA: string[], teamB: string[], teamC: string[]) {
    const openai = getOpenAIClient();
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: SYSTEM_INSTRUCTION },
        {
          role: "user", content: `Narre o sorteio dos times.
          Bonde A: ${teamA.join(', ')}
          Bonde B: ${teamB.join(', ')}
          Bonde C: ${teamC.join(', ')}
          Fale qual time vai dar W.O. por overdose, qual vai brigar e qual é horrível.` }
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
        { role: "user", content: `O vagabundo ${name} desbloqueou: ${badgeName}. Zoa ele.` }
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
        { role: "user", content: `O nóia do ${userName} falou: "${userMessage}". Responda na lata, xingando ou zoando.` }
      ]
    });
    return response.choices[0].message.content || "";
  },

  async generatePlayerReply(targetMessage: string, authorName: string, responderName: string, responderStats: string) {
    const openai = getOpenAIClient();
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "Aja como um participante de um grupo de futebol de várzea. Informalidade extrema." },
        {
          role: "user", content: `Você está interpretando o jogador de várzea "${responderName}".
          Seus dados: ${responderStats}.
          
          Situação: O jogador "${authorName}" mandou no grupo do Zap: "${targetMessage}".
          
          Tarefa: Responda essa mensagem COMO SE FOSSE O ${responderName}.
          Estilo: Curto, gíria de favela, erro de português proposital (tipo "ta lgd", "fml"), agressivo ou zoeiro.
          Se você for goleiro e tomou gol, seja defensivo. Se for perna de pau, disfarça.
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
      ? `Escreva um parágrafo de "exaltação suprema". O cara é o craque. Use gíria de respeito, chame de gênio, ídolo, diferenciado. O tom deve ser de admiração extrema.`
      : `Escreva um parágrafo de "dossiê de inteligência" esculachando o estilo de jogo dele. Seja criativo, maldoso e use gíria de esculacho.`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: SYSTEM_INSTRUCTION },
        {
          role: "user", content: `Analise o jogador ${name}. 
          Estatísticas: ${stats}
          Contexto de Atos Memoráveis/Vexames da semana: ${manualEvents || 'Nenhuma presepada registrada ainda.'}
          Tarefa: ${task}
          Máximo 40 palavras.` }
      ]
    });
    return response.choices[0].message.content || "";
  }
};
