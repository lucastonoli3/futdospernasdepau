import React, { ErrorInfo } from 'react';

interface Props {
    children: React.ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

class ErrorBoundary extends React.Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error("ERRO CRÍTICO NO BUEIRO:", error, errorInfo);
    }

    private handleReset = () => {
        // Limpa o localStorage que pode estar "envenenado"
        const keysToRemove = [
            'fdp_teams',
            'fdp_active_teams',
            'fdp_score',
            'fdp_game_events',
            'fdp_match_active',
            'fdp_match_time',
            'fdp_match_paused',
            'fdp_active_tab'
        ];
        keysToRemove.forEach(k => localStorage.removeItem(k));

        // Recarrega a página do zero
        window.location.reload();
    };

    public render() {
        if (this.state.hasError) {
            return (
                <div className="fixed inset-0 bg-black flex flex-col items-center justify-center p-6 text-center z-[9999]">
                    <div className="max-w-md w-full glass-panel border-red-600/30 p-10 rounded-[40px] shadow-[0_0_50px_rgba(220,38,38,0.2)]">
                        <span className="text-6xl mb-6 block animate-bounce">🚨</span>
                        <h1 className="font-oswald text-4xl font-black text-white uppercase italic tracking-tighter mb-4">
                            ERRO NO <span className="text-red-600">BUEIRO!</span>
                        </h1>
                        <p className="text-neutral-400 font-mono text-xs uppercase tracking-widest leading-relaxed mb-8">
                            O sistema detectou uma falha crítica na Matrix. Provavelmente algum dado corrompido está tentando sabotar a pelada.
                        </p>

                        <div className="bg-red-900/10 border border-red-900/20 p-4 rounded-2xl mb-8 text-left overflow-hidden">
                            <p className="text-[10px] font-mono text-red-500 uppercase font-black mb-1">Causa Provável:</p>
                            <p className="text-[9px] font-mono text-neutral-500 break-all">
                                {this.state.error?.message || "Erro de renderização desconhecido"}
                            </p>
                        </div>

                        <button
                            onClick={this.handleReset}
                            className="w-full py-4 bg-red-600 text-white font-oswald font-black uppercase italic tracking-[0.2em] rounded-2xl hover:bg-red-500 transition-all shadow-[0_10px_30px_rgba(220,38,38,0.3)] active:scale-95"
                        >
                            LIMPAR E RECOMECAR 🧹
                        </button>

                        <p className="mt-6 text-[9px] text-neutral-600 font-mono uppercase tracking-widest">
                            Isso vai resetar o cronômetro e os times locais.
                        </p>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
