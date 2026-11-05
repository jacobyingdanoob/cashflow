import {
  encyclopediaExpenses,
  encyclopediaLargeDeals,
  encyclopediaMarkets,
  encyclopediaSmallDeals,
  encyclopediaSpecialSource,
} from "../game/encyclopedia";
import { preciseMoney } from "../game/engine";
import CardSource from "./CardSource";
export default function EncyclopediaCards({ enabled }: { enabled: boolean }) {
  return (
    <details className="encyclopedia-catalog">
      <summary>Adapted card catalogue · 62 cards + 3 board events</summary>
      <p>
        Adapted from the{" "}
        <a
          href="https://cashflow.lifestyle/encyclopedia/"
          target="_blank"
          rel="noreferrer"
        >
          Cash Flow Lifestyle encyclopedia ↗
        </a>
        .{" "}
        {enabled
          ? "Enabled in this match: these cards join the original decks."
          : "Disabled in this match. Enable adapted cards in the new-game sandbox to include this pack."}{" "}
        Baseline amounts below exclude active economic cycles. Some financed
        properties lose money; stocks in this set pay no recurring dividend.
      </p>
      {(
        [
          ["Small opportunities", encyclopediaSmallDeals],
          ["Large opportunities", encyclopediaLargeDeals],
        ] as const
      ).map(([label, cards]) => (
        <details key={label} className="adapted-deck">
          <summary>
            {label} · {cards.length} cards
          </summary>
          <CardSource
            source={cards.find((c) => c.category === "property")!.source}
          />
          <div
            className="card-table-scroll"
            role="region"
            aria-label={`${label} card table`}
            tabIndex={0}
          >
            <table>
              <caption>
                {label}: prices and monthly amounts in USD; stock prices are per
                share.
              </caption>
              <thead>
                <tr>
                  <th scope="col">Card</th>
                  <th scope="col">Price</th>
                  <th scope="col">Cash needed</th>
                  <th scope="col">Financing / mo</th>
                  <th scope="col">Net income / mo</th>
                </tr>
              </thead>
              <tbody>
                {cards.map((c) => (
                  <tr key={c.id}>
                    <th scope="row">{c.name}</th>
                    <td>{preciseMoney(c.cost)}</td>
                    <td>{preciseMoney(c.down)}</td>
                    <td>{preciseMoney(c.financing)}</td>
                    <td>{preciseMoney(c.income)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      ))}
      <details className="adapted-deck">
        <summary>Market buyers · 12 cards</summary>
        <CardSource source={encyclopediaMarkets[0].source} />
        <div
          className="card-table-scroll"
          role="region"
          aria-label="Market buyers card table"
          tabIndex={0}
        >
          <table>
            <caption>
              Baseline offers; current economic conditions apply when a card is
              drawn.
            </caption>
            <thead>
              <tr>
                <th scope="col">Card</th>
                <th scope="col">Eligible holdings</th>
                <th scope="col">Offer before mortgage settlement</th>
              </tr>
            </thead>
            <tbody>
              {encyclopediaMarkets.map((c) => (
                <tr key={c.id}>
                  <th scope="row">{c.name}</th>
                  <td>
                    {c.category === "stock"
                      ? "All stocks and funds"
                      : c.category}
                  </td>
                  <td>
                    {c.sharePrice !== undefined
                      ? `${preciseMoney(c.sharePrice)} / share`
                      : `${c.multiplier}× current value`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
      <details className="adapted-deck">
        <summary>Life expenses · 15 cards</summary>
        <CardSource source={encyclopediaExpenses[0].source} />
        <div
          className="card-table-scroll"
          role="region"
          aria-label="Life expenses card table"
          tabIndex={0}
        >
          <table>
            <caption>
              Fixed cash bills; the same amount applies to every profession.
            </caption>
            <thead>
              <tr>
                <th scope="col">Card</th>
                <th scope="col">Cash bill</th>
                <th scope="col">Situation</th>
              </tr>
            </thead>
            <tbody>
              {encyclopediaExpenses.map((c) => (
                <tr key={c.id}>
                  <th scope="row">{c.name}</th>
                  <td>{preciseMoney(c.cost)}</td>
                  <td>{c.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
      <details className="adapted-deck">
        <summary>Baby, downsizing & charity · 3 existing board events</summary>
        <p>{encyclopediaSpecialSource.adaptation}</p>
        <a
          href={encyclopediaSpecialSource.url}
          target="_blank"
          rel="noreferrer"
        >
          Compare the source special-event rules ↗
        </a>
      </details>
    </details>
  );
}
