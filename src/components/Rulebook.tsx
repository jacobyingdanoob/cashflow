import { personalities } from "../game/personalities";
export default function Rulebook() {
  return (
    <div className="rulebook">
      <p className="muted">
        The rules for new matches. Financial values are simplified game
        economics, in USD. Every player uses the same prices, fees, dice and
        starting financial sheet.
      </p>
      <section>
        <h3>1. Set up the table</h3>
        <p>
          Choose 1–8 NPCs; the default is 4. One role is drawn from your chosen
          difficulty and shared by everyone. Salary, cash, debts, taxes,
          household expenses and child costs start equal. NPC decision
          difficulty changes decision quality. Financial settings stay fixed
          during a match.
        </p>
      </section>
      <section>
        <h3>2. Play a turn</h3>
        <p>
          Roll and move around the 24-space Rat Race. Passing or landing on
          Payday collects monthly cash flow, or charges a deficit. Resolve the
          landing, manage debt, then end the turn. A round ends once every
          active player has played. Automatic events produce expandable
          30-second notifications.
        </p>
      </section>
      <section>
        <h3>3. Three opportunity types</h3>
        <ul>
          <li>
            <b>Type 1: financed property or business.</b> Pay the down payment
            and acquisition fee. The asset includes a mortgage; quoted net
            passive income already deducts its financing payment.
          </li>
          <li>
            <b>Type 2: debt-free property or business.</b> Pay the full price
            and acquisition fee once. A separate bank loan used to fund it stays
            your personal debt when you sell.
          </li>
          <li>
            <b>Type 3: stocks.</b> Buy whole shares. Stocks have no acquisition
            or sale fee, but positive sale profits are taxed. Some pay
            dividends; others depend entirely on price gains.
          </li>
        </ul>
        <p>
          Financed Type 1 down payments rise with your lifetime financed
          acquisitions:{" "}
          <b>
            first 10%, second 15%, third 20%, fourth 25%, fifth and later 35%
          </b>{" "}
          of the current full price. Selling or repaying a mortgage does not
          reset this count. An outright purchase does not advance it. The
          remaining price becomes the included mortgage. Its payment scales
          proportionally with its principal, so a larger down payment lowers
          financing and raises net passive income while operating income stays
          the same. The 5% acquisition fee is separate.
        </p>
        <p>
          You may buy a financed opportunity outright: pay its full price plus
          acquisition fee, take no mortgage, and keep operating income before
          financing.
        </p>
      </section>
      <section>
        <h3>4. Acquisition, sale and tax calculations</h3>
        <p>
          Open Portfolio to sell at any time, including between your turns.
          Stocks sell immediately at the current price. Businesses close after a
          random 1–3 rounds with a <b>5% quick-sale discount</b>; real estate
          closes after 1–3 rounds with a <b>15% discount</b>. These discounts
          reduce gross sale proceeds, not monthly income. The gross price is
          locked when listed. Income and financing continue until closing at the
          start of the owner's turn in the stated round. You can cancel a
          listing before it closes. Finish any required worksheet before making
          another transaction.
        </p>
        <p>
          Matching market-space sales remain immediate and have no quick-sale
          discount, even for a listed asset. Existing selling fees, tax,
          early-payoff penalties and mortgage settlement apply to either route.
          Closing costs use the remaining mortgage and ownership age at closing;
          if cash cannot cover a shortfall, the listing is cancelled without
          fees. Distress recovery remains separate and provides no waiting
          period.
        </p>
        <ul>
          <li>
            Buying Type 1 or Type 2 costs an additional{" "}
            <b>5% of the full current purchase price</b>, including when the
            opportunity is transferred.
          </li>
          <li>
            Selling property or a business costs{" "}
            <b>10% of the gross sale price</b>.
          </li>
          <li>
            Selling an asset with an outstanding included mortgage during its
            first <b>10 rounds of ownership</b> also costs{" "}
            <b>two current monthly financing payments</b>. A round-1 purchase
            has the penalty through round 10; round 11 is exempt. Standalone
            voluntary repayments have no sale penalty.
          </li>
          <li>
            Capital-gains tax is <b>20% of positive profit</b>: gross price −
            sale fee − early-payoff penalty − original full purchase price −
            acquisition fee. Losses create no tax credit.
          </li>
          <li>
            Cash received = gross price − sale fee − penalty − tax − remaining
            included mortgage. Mortgage principal settlement does not reduce
            taxable profit. A negative result must be covered from cash.
          </li>
        </ul>
        <p>
          <b>Example:</b> Your third financed Type 1 purchase is a $100,000
          property with $20,000 down and a $5,000 acquisition fee. Sell for
          $130,000 before round 11 with an $80,000 mortgage and $600 monthly
          financing: $13,000 sale fee, $1,200 penalty, $10,800 taxable profit
          and $2,160 tax leave <b>$33,640 cash</b>.
        </p>
      </section>
      <section>
        <h3>5. Persistent markets</h3>
        <p>
          Stocks, real estate and businesses each start at a 100% price index. A
          market landing draws an immediate 15%–50% shock to one category.
          Larger shocks are rarer: each signed 15%, 20%, 30%, 40% and 50% card
          has 10, 6, 3, 2 and 1 copies, respectively. Every eligible owner, on
          either track, can sell multiple holdings or hold. Revaluations affect
          all portfolios immediately, without changing cash or debt principal.
        </p>
        <p>
          Every new round fluctuates real estate within ±0.25%, businesses
          within ±1%, and stocks by either −3% to −2% or +2% to +3%, with equal
          direction odds. These fluctuations continue during economic cycles.
          Starting in round 5, an economic trend card is drawn every five rounds
          and acts for three rounds, including its draw round. Cycle baselines
          range from 3%–6.5% for property, 4.5%–8% for businesses and 6.5%–9.5%
          for stocks, depending on the card. A pull toward 100% adjusts their
          direction and strength at extreme prices. Combined with noise, cycle
          movement is at least 2%, 3% and 5% respectively, and at most 14% per
          round: stronger than ordinary fluctuations, weaker than a market-space
          shock.
        </p>
        <p>
          Changes compound and are never undone at expiry. A trend and a market
          landing can affect the same category in the same round. Click the card
          beside the round counter for its ranges, duration and real-life
          scenario. The market watch ticker shows the total percentage change
          since the current round opened, including shocks. Chart lines connect
          recorded prices diagonally, with markers ordered within each round.
        </p>
        <p>
          <b>Shared discount offer:</b> when a market space leaves its market
          strictly below 50%, finish all players' sale responses first. The game
          then draws one random small or large asset from that market. Each
          eligible player receives the same asset and price, and may buy once or
          pass. The human's choice appears in a central popup. Stock share
          quantities, acquisition fees, financing, liquidity rules and manual
          accounting still apply. Recovery and eliminated players cannot buy.
          The adapted-card setting applies; unique Fast Track businesses stay on
          the board. The next response waits until any worksheet is correct.
        </p>
        <p>
          <b>Depression:</b> when a market falls strictly below 35%, a seeded
          random lock lasts 5–10 rounds, counting the entry round. Prices
          continue fluctuating but stay below 35%. Its cycle force pauses during
          the lock; market-space shocks also respect the ceiling. Other markets
          keep moving normally. The cap lifts at expiry without resetting
          prices. Remaining below 35% alone does not start another lock; the
          market must recover to at least 35% and then cross below again.
        </p>
        <p>
          Property operating rent stays unchanged. Business and stock operating
          income follow one quarter of the index movement from its opening
          level: an 80% price index means 95% operating income. Financing is
          deducted afterward. New opportunities use current prices. Indices stay
          between 10% and 500% to keep the sandbox finite. Charts use rounds
          along the bottom, percentages on the right, and markers for each
          event.
        </p>
      </section>
      <section>
        <h3>6. Borrowing and liquidity</h3>
        <p>
          New ordinary bank loans cost <b>2% per month</b> on outstanding
          principal. A separate <b>Type 1 purchase loan costs 1% per month</b>
          and can cover the down payment, fee, and cash buffer. Choose its
          amount during a financed Type 1 purchase; the loan and asset commit
          together. It is unavailable for stocks, Type 2 assets, outright
          purchases or bankruptcy recovery. Both loan types use $1,000 borrowing
          increments, up to $1,000,000 per loan action, and remain separate from
          the asset's included mortgage. Selling the asset settles that
          mortgage; purchase and ordinary bank loans remain your responsibility.
          Existing saved bank loans keep their original rate, with new borrowing
          tracked separately.
        </p>
        <p>
          <b>New debt must fit a 55% debt-to-income (DTI) limit.</b> Add all
          investment mortgage payments and interest on ordinary and purchase
          loans, including proposed new debt. Divide by salary plus passive
          income <b>after operating costs and investment mortgage financing</b>,
          including the new asset. Starting role debts are excluded from this
          test; they still affect household expenses and liquidity reserves.
          Exactly 55% is allowed. A higher ratio or nonpositive qualifying
          income declines new debt, for humans and NPCs alike. Cash-only
          purchases and existing mortgages are not retroactively declined after
          a market loss. Personal-loan interest is counted in household expenses
          once; it is shown separately from the asset's net passive income.
          Ordinary bank borrowing is tested before any later purchase adds
          income.
        </p>
        <p>
          Optional partial repayments can be any positive cent amount and
          proportionally lower recurring payments. Principal autopay is off
          unless selected at setup. Investment financing is never deducted
          twice.
        </p>
        <p>
          When liquidity risk is enabled, keep cash at least 10% of all debt,
          including investment mortgages. Falling below that threshold at a turn
          check requires a distress sale or bankruptcy recovery. Exact equality
          is allowed, but leaves no shock buffer. Distress sales recover half
          current equity and settle the included mortgage; ordinary market sale
          fees and tax do not apply to bankruptcy liquidation.
        </p>
      </section>
      <section>
        <h3>7. Know your opponents</h3>
        <div className="personality-grid">
          {Object.entries(personalities).map(([id, p]) => (
            <article key={id}>
              <h4>{p.name}</h4>
              <blockquote>“{p.philosophy}”</blockquote>
              <strong>{p.priority}</strong>
              <p>{p.behavior}</p>
            </article>
          ))}
        </div>
        <p>
          Every reserve target includes any chosen principal installment. The
          legal 10% debt floor takes priority over a personality's lower target.
          Hard NPCs add 10% to their expense buffer. Personality rules never
          expose future rolls or hidden decks. Aggressive borrowing and
          speculation can cause losses or elimination. All personalities obey
          rising down payments and the 55% lending limit. Aggressive borrowers
          may add a 1% purchase loan; balanced investors compare its cost with
          net income and preserve reserves. Conservative savers still decline
          Type 1 assets, and speculators favor stocks and outright purchases.
        </p>
      </section>
      <section>
        <h3>8. Events and recovery</h3>
        <p>
          Life expenses are mandatory. Family events add a role-specific child
          cost, up to three children. Downsizing charges one month's expenses
          and skips two turns. Charity is optional and grants additional dice.
          Bankruptcy attempts distress liquidation and debt repayment, then
          one-time consumer-debt relief if needed. Successful recovery skips
          three turns and blocks new borrowing; an unrecoverable player is
          eliminated.
        </p>
      </section>
      <section>
        <h3>9. Win the game</h3>
        <p>
          Passive income strictly above expenses qualifies for the Fast Track at
          the start of a turn. Financial-freedom mode ends there. In the full
          game, keep your finances, then buy your chosen dream or reach the
          configured additional passive income over your Fast Track entry
          amount. The 32-space outer board supports up to nine distinct dreams;
          other players' visits increase a dream's price. At a round cap, rank
          by passive income divided by expenses, then net worth; exact ties
          share victory.
        </p>
      </section>
      <section>
        <h3>10. Accounting, reports and saves</h3>
        <p>
          Automatic accounting posts transactions with receipts. Guided manual
          accounting asks you to enter changed totals; correct entries commit
          once, and incorrect entries stay editable without penalty. Shared
          price revaluations post together; voluntary trades still use the
          auditor. Eliminated players receive a personal report while NPCs
          continue, followed by the final match report. The coach reviews debt
          reserves, shocks and recorded decisions.
        </p>
        <p>
          One autosave and three named saves belong to this browser. Pending
          worksheets, market history, purchase rounds, tax basis and random
          state, trend deck and active trend duration are retained. Existing
          persistent-market saves gain round movements from their next round,
          preserving finances and historical prices. Their next market draw
          starts the weighted shock deck. Saves predating persistent markets
          continue under their original rules.
        </p>
      </section>
    </div>
  );
}
