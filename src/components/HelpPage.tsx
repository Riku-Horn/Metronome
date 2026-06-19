interface HelpPageProps {
  onClose: () => void;
}

export function HelpPage({ onClose }: HelpPageProps) {
  return (
    <div className="help-backdrop" onClick={onClose}>
      <div className="help-panel" onClick={(e) => e.stopPropagation()}>
        <div className="help-header">
          <h1 className="help-title">使い方・機能説明</h1>
          <button
            className="help-close-btn"
            onClick={onClose}
            aria-label="閉じる"
          >
            ✕
          </button>
        </div>

        <div className="help-content">
          {/* Section: Overview */}
          <section className="help-section">
            <h2 className="help-section-title">概要</h2>
            <p className="help-text">
              変拍子やテンポ変化に対応した、練習用のメトロノームアプリです。
              当面の間、付喪神の二楽章専用とします。
            </p>
          </section>

          {/* Section: Basic Operation */}
          <section className="help-section">
            <h2 className="help-section-title">基本操作</h2>
            <dl className="help-dl">
              <div className="help-dl-item">
                <dt>再生 / 停止</dt>
                <dd>画面中央の丸いボタンをタップします。</dd>
              </div>
              <div className="help-dl-item">
                <dt>テンポ（BPM）の変更</dt>
                <dd>右下の「BPM」エリアで、＋/− ボタン・数値入力・スライダーから変更できます。</dd>
              </div>
              <div className="help-dl-item">
                <dt>IN TEMPO にスナップ</dt>
                <dd>
                  現在のテンポが曲の指定テンポと異なる場合、「IN TEMPO (xxx) にスナップ」ボタンが表示されます。
                  タップすると、その小節の指定テンポに即座に戻ります。
                </dd>
              </div>
            </dl>
          </section>

          {/* Section: Position */}
          <section className="help-section">
            <h2 className="help-section-title">再生位置の選択</h2>
            <p className="help-text">左下の「再生位置」パネルから、3つの方法で再生開始位置を指定できます。</p>
            <dl className="help-dl">
              <div className="help-dl-item">
                <dt>練習番号</dt>
                <dd>セクション（A, B, C…）を選択して、そのセクションの先頭にジャンプします。</dd>
              </div>
              <div className="help-dl-item">
                <dt>小節</dt>
                <dd>
                  選択中のセクション内の小節番号を指定します。
                  <strong>−5〜−1</strong> を選ぶと、そのセクションの直前の小節にジャンプできるため、
                  「Bの5小節前から」といった練習が可能です。
                </dd>
              </div>
              <div className="help-dl-item">
                <dt>通し</dt>
                <dd>曲頭からの累計小節番号で直接指定します。</dd>
              </div>
            </dl>
          </section>

          {/* Section: Auto Tempo */}
          <section className="help-section">
            <h2 className="help-section-title">自動テンポ追従</h2>
            <p className="help-text">
              以下のタイミングで、テンポが自動的にインテンポに切り替わります。
            </p>
            <ul className="help-list">
              <li>曲データの読み込み時（最初の小節のテンポに設定）</li>
              <li>再生位置をジャンプした時（ジャンプ先の小節のテンポに設定）</li>
              <li>再生中に曲のテンポが変わる小節に到達した時</li>
            </ul>
          </section>

          {/* Section: Beat Pattern */}
          <section className="help-section">
            <h2 className="help-section-title">拍の表示パターン</h2>
            <dl className="help-dl">
              <div className="help-dl-item">
                <dt>x/4 拍子</dt>
                <dd>8分音符単位で表示（4/4 → A B A B A B A B）</dd>
              </div>
              <div className="help-dl-item">
                <dt>7/8 拍子</dt>
                <dd>2+2+3 グルーピング（A B A B A A A）</dd>
              </div>
            </dl>
          </section>
        </div>
      </div>
    </div>
  );
}
