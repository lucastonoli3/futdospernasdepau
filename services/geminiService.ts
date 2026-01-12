/// <reference types="vite/client" />
import { GoogleGenerativeAI } from "@google/generative-ai";

const SYSTEM_INSTRUCTION = `Você é o narrador oficial do FUT DOS PERNAS DE PAU, uma pelada de várzea no Espírito Santo cheia de maconheiro, bêbado e gente ruim de bola.
SEU ESTILO:
- Favelado, boca suja, agressivo e sem frescura.
- Use MUITA gíria de quebrada, palavrão (pode censurar levemente se precisar, tipo p*rra), e referências a cachaça, cigarro, dívida e polícia.
- Se o cara for ruim, humilhe. Diga que ele usa droga estragada, que tá de ressaca, que tem dois pés esquerdos.
- NÃO SEJA "JOGADOR DE CONDOMÍNIO". Você é da lama.
- Se alguém falar "bom dia", mande tomar no c*.
- O tom é de humilhação e zoeira pesada, humor negro sobre a desgraça alheia (mas evite racismo/xenofobia explícita pra não cair o servidor, foca na ofensa pessoal e na ruindade).`;

export const geminiService = {
  async generateBestPlayerText(name: string, position: string, stats: string) {
    console.log("Gemini: Iniciando geração com chave:", !!import.meta.env.VITE_GEMINI_API_KEY);
    const ai = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY || "");
    // @ts-ignore
    const model = ai.getGenerativeModel({
      model: 'gemini-1.5-flash',
      systemInstruction: SYSTEM_INSTRUCTION
    });
    const result = await model.generateContent(`Gere uma exaltação exagerada (tipo "o rei da boca") para o MENOS PIOR DA PELADA.
      Vagabundo: ${name}
      Posição: ${position}
      O que fez: ${stats}
      Regras: Max 3 frases, gíria de favela, fala que ele tá "na onda" ou "puro ódio".`);
    const response = await result.response;
    return response.text();
  },

  async generateWorstPlayerText(name: string, errors: string) {
    const ai = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY || "");
    // @ts-ignore
    const model = ai.getGenerativeModel({
      model: 'gemini-1.5-flash',
      systemInstruction: SYSTEM_INSTRUCTION
    });
    const result = await model.generateContent(`Humilhe o PIOR DA PELADA.
      Lixo: ${name}
      Cagadas: ${errors}
      Regras: Max 2 frases, fala que ele usou droga vencida, tá bêbado ou é um inútil.`);
    const response = await result.response;
    return response.text();
  },

  async generateGoalieComment(name: string, situation: 'fechou_o_gol' | 'frangou' | 'salvou_time') {
    const ai = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY || "");
    // @ts-ignore
    const model = ai.getGenerativeModel({
      model: 'gemini-1.5-flash',
      systemInstruction: SYSTEM_INSTRUCTION
    });
    const result = await model.generateContent(`Comente o goleiro ${name}. Situação: ${situation}. Seja curto e grosso.`);
    const response = await result.response;
    return response.text();
  },

  async generateTeamDrawComment(teamA: string[], teamB: string[], teamC: string[]) {
    const ai = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY || "");
    // @ts-ignore
    const model = ai.getGenerativeModel({
      model: 'gemini-1.5-flash',
      systemInstruction: SYSTEM_INSTRUCTION
    });
    const result = await model.generateContent(`Narre o sorteio dos times.
      Bonde A: ${teamA.join(', ')}
      Bonde B: ${teamB.join(', ')}
      Bonde C: ${teamC.join(', ')}
      Fale qual time vai dar W.O. por overdose, qual vai brigar e qual é horrível.`);
    const response = await result.response;
    return response.text();
  },

  async generateBadgeUnlock(name: string, badgeName: string) {
    const ai = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY || "");
    // @ts-ignore
    const model = ai.getGenerativeModel({
      model: 'gemini-1.5-flash',
      systemInstruction: SYSTEM_INSTRUCTION
    });
    const result = await model.generateContent(`O vagabundo ${name} desbloqueou: ${badgeName}. Zoa ele.`);
    const response = await result.response;
    return response.text();
  },

  async generateResenhaResponse(userMessage: string, userName: string) {
    const ai = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY || "");
    // @ts-ignore
    const model = ai.getGenerativeModel({
      model: 'gemini-1.5-flash',
      systemInstruction: SYSTEM_INSTRUCTION
    });
    const result = await model.generateContent(`O nóia do ${userName} falou: "${userMessage}". Responda na lata, xingando ou zoando.`);
    const response = await result.response;
    return response.text();
  },

  async generatePlayerReply(targetMessage: string, authorName: string, responderName: string, responderStats: string) {
    const ai = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY || "");
    // @ts-ignore
    const model = ai.getGenerativeModel({
      model: 'gemini-1.5-flash',
      systemInstruction: "Aja como um participante de um grupo de futebol de várzea. Informalidade extrema."
    });
    const result = await model.generateContent(`Você está interpretando o jogador de várzea "${responderName}".
      Seus dados: ${responderStats}.
      
      Situação: O jogador "${authorName}" mandou no grupo do Zap: "${targetMessage}".
      
      Tarefa: Responda essa mensagem COMO SE FOSSE O ${responderName}.
      Estilo: Curto, gíria de favela, erro de português proposital (tipo "ta lgd", "fml"), agressivo ou zoeiro.
      Se você for goleiro e tomou gol, seja defensivo. Se for perna de pau, disfarça.
      NÃO ASSINE A MENSAGEM. SÓ O TEXTO.`);
    const response = await result.response;
    return response.text();
  },

  async validateFaceInImage(base64Image: string): Promise<boolean> {
    const ai = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY || "");
    const cleanBase64 = base64Image.replace(/^data:image\/(png|jpeg|jpg);base64,/, "");

    try {
      // @ts-ignore
      const model = ai.getGenerativeModel({
        model: 'gemini-1.5-flash'
      });
      const result = await model.generateContent({
        contents: [
          {
            role: 'user',
            parts: [
              { inlineData: { mimeType: 'image/jpeg', data: cleanBase64 } },
              { text: "Analise esta imagem. Ela contem claramente um rosto humano visível? Responda APENAS com a palavra 'SIM' ou 'NAO'. Sem explicações." }
            ]
          }
        ]
      });
      const response = await result.response;
      const text = response.text().trim().toUpperCase();
      return text.includes('SIM');
    } catch (e) {
      console.error("Erro na validação de face:", e);
      return true; // Fallback
    }
  },

  async generatePlayerDossier(name: string, stats: string, moralScore: number, manualEvents?: string) {
    console.log("Gemini: Gerando dossiê para", name, "com chave:", !!import.meta.env.VITE_GEMINI_API_KEY);
    const ai = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY || "");
    // @ts-ignore
    const model = ai.getGenerativeModel({
      model: 'gemini-1.5-flash',
      systemInstruction: SYSTEM_INSTRUCTION
    });

    const isHero = moralScore > 75;
    const task = isHero
      ? `Escreva um parágrafo de "exaltação suprema". O cara é o craque. Use gíria de respeito, chame de gênio, ídolo, diferenciado. O tom deve ser de admiração extrema.`
      : `Escreva um parágrafo de "dossiê de inteligência" esculachando o estilo de jogo dele. Seja criativo, maldoso e use gíria de esculacho.`;

    const result = await model.generateContent(`Analise o jogador ${name}. 
      Estatísticas: ${stats}
      Contexto de Atos Memoráveis/Vexames da semana: ${manualEvents || 'Nenhuma presepada registrada ainda.'}
      Tarefa: ${task}
      Máximo 40 palavras.`);
    const response = await result.response;
    return response.text();
  }
};
