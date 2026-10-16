import { Component, type ReactNode } from 'react';

type Props = { children: ReactNode };
type State = { error: Error | null };

export default class AssessmentErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  retry = () => {
    this.setState({ error: null });
  };

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="cza-shell">
        <main className="cza-wrap" style={{ maxWidth: 720, paddingTop: 48, paddingBottom: 48 }}>
          <section className="cza-card" style={{ padding: 28 }}>
            <div className="cza-kicker">Değerlendirme durdurulmadı</div>
            <h1 style={{ margin: '8px 0 10px' }}>Bu ekran açılamadı</h1>
            <p className="cza-muted" style={{ lineHeight: 1.6 }}>
              Kaydedilmiş yanıtlar duruyor. Bu bölümün henüz kaydedilmemiş sorusu baştan açılır; önceki bölümler yerinde kalır.
            </p>
            <button type="button" className="cza-btn cza-primary" style={{ marginTop: 18, minHeight: 48 }} onClick={this.retry}>
              Kaldığın yerden devam et
            </button>
          </section>
        </main>
      </div>
    );
  }
}
