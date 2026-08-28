// Metrikler sayfası — 3 dönem arası geçiş yapan canlı oynatıcı.
// Tamamen seed verisinden beslenir, ağa çıkmaz. Sayı değişimleri hafif animasyonlu.
import { useState } from 'react';
import { getSeed } from '@seed/index';
import { formatCurrency } from '@lib/format';

const seed = getSeed('full');

export default function MetricsPlayground({ locale = 'tr' }) {
  const [periodKey, setPeriodKey] = useState('this-month');
  const period = seed.insights.find((i) => i.period.key === periodKey);

  return (
    <div className="metrics-playground">
      <div className="metrics-playground__tabs" role="tablist">
        {seed.insights.map((i) => (
          <button
            key={i.period.key}
            type="button"
            role="tab"
            aria-selected={i.period.key === periodKey}
            className={i.period.key === periodKey ? 'is-active' : ''}
            onClick={() => setPeriodKey(i.period.key)}
          >
            {i.period.label}
          </button>
        ))}
      </div>

      <div className="metrics-playground__stats">
        <div className="metrics-playground__stat metrics-playground__stat--good">
          <p className="metrics-playground__value">{formatCurrency(period.saved)}</p>
          <p className="metrics-playground__label">{locale === 'tr' ? 'Biriken' : 'Saved'}</p>
        </div>
        <div className="metrics-playground__stat metrics-playground__stat--bad">
          <p className="metrics-playground__value">{formatCurrency(period.wasted)}</p>
          <p className="metrics-playground__label">{locale === 'tr' ? 'İsraf' : 'Wasted'}</p>
        </div>
        <div className="metrics-playground__stat">
          <p className="metrics-playground__value">{formatCurrency(period.spent)}</p>
          <p className="metrics-playground__label">{locale === 'tr' ? 'Alınan' : 'Bought'}</p>
        </div>
      </div>

      <div className="metrics-playground__breakdown">
        <div>
          <h3>{locale === 'tr' ? 'Kategoriye göre' : 'By category'}</h3>
          <ul>
            {period.byCategory.map((c) => (
              <li key={c.categoryKey}>
                <span>{c.categoryKey}</span>
                <span className="good">{formatCurrency(c.saved)}</span>
                <span className="bad">{formatCurrency(c.wasted)}</span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3>{locale === 'tr' ? 'En çok israf' : 'Most wasted'}</h3>
          <ul>
            {period.topWasted.map((t, i) => (
              <li key={i}>
                <span>{t.productName}{t.productBrand ? ` · ${t.productBrand}` : ''}</span>
                <span className="bad">{formatCurrency(t.wasted)}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {period.missingPriceCount > 0 && (
        <p className="metrics-playground__note">
          {locale === 'tr'
            ? `${period.missingPriceCount} hareket fiyatsız olduğu için toplamlara dahil edilmedi.`
            : `${period.missingPriceCount} movements were excluded from totals because they have no price.`}
        </p>
      )}
    </div>
  );
}
