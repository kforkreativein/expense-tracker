import { Transaction } from './types';
import { getSpendCategories } from './spendCategories';
import { fmt } from './insights';
import { isInternalTransferTxn, getInternalTransferTxnIds, getTransfers } from './transfers';

export interface AiInsightCard {
  id: string;
  body: string;
  highlight?: string;
  action?: string;
}

function daysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function dayOfMonth(d = new Date()) {
  return d.getDate();
}

/** Local heuristic insights — pacing, categories, habits. */
export function buildAiInsights(
  monthTxns: Transaction[],
  budget: number,
  income: number,
  year: number,
  month: number,
): AiInsightCard[] {
  const transferIds = getInternalTransferTxnIds(getTransfers());
  const expenses = monthTxns.filter(t => t.type === 'expense' && !isInternalTransferTxn(t, transferIds));
  const incomes = monthTxns.filter(t =>
    (t.type === 'income' || t.type === 'investment') && !isInternalTransferTxn(t, transferIds),
  );
  const spent = expenses.reduce((s, t) => s + t.amount, 0);
  const earned = incomes.reduce((s, t) => s + t.amount, 0);
  const cards: AiInsightCard[] = [];

  if (expenses.length === 0 && incomes.length === 0) {
    cards.push({ id: 'empty', body: 'Add transactions to get AI insights.' });
    return cards;
  }

  const days = daysInMonth(year, month);
  const day = Math.min(dayOfMonth(), days);
  const perDay = spent / Math.max(day, 1);
  const projected = Math.round(perDay * days);

  if (expenses.length > 0) {
    cards.push({
      id: 'pace',
      body: `You've spent ${fmt(spent)} so far — around ${fmt(Math.round(perDay))}/day across ${day} of ${days} days. On this pace you're heading toward about ${fmt(projected)} by month-end.`,
      highlight: income > 0
        ? (projected <= income
          ? `You're pacing under your salary — hold daily spend near ${fmt(Math.round(income / days))}.`
          : `At this pace you'll overshoot income by about ${fmt(projected - income)}.`)
        : budget > 0
          ? (projected <= budget
            ? `Stay near ${fmt(Math.round(budget / days))}/day to finish inside budget.`
            : `Projected over budget by ${fmt(projected - budget)}.`)
          : 'Set a monthly budget to unlock pacing tips.',
    });
  }

  const cats = getSpendCategories();
  const byId: Record<string, number> = {};
  let other = 0;
  for (const t of expenses) {
    if (t.spendCategoryId) byId[t.spendCategoryId] = (byId[t.spendCategoryId] ?? 0) + t.amount;
    else other += t.amount;
  }
  const ranked = [
    ...cats.map(c => ({ name: c.name, amount: byId[c.id] ?? 0 })),
    ...(other > 0 ? [{ name: 'Others', amount: other }] : []),
  ].filter(r => r.amount > 0).sort((a, b) => b.amount - a.amount);

  if (ranked[0]) {
    const top = ranked[0];
    const share = spent > 0 ? Math.round((top.amount / spent) * 100) : 0;
    const trim = Math.round(top.amount * 0.15);
    const cap = Math.round(top.amount * 0.85);
    cards.push({
      id: 'top-cat',
      body: ranked.length === 1
        ? `All your spend so far is in ${top.name} (${fmt(top.amount)})${income > 0 ? `, about ${Math.round((top.amount / income) * 100)}% of your salary` : ''}. A single-category month is fine, just keep an eye on balance.`
        : `${top.name} is your biggest outflow at ${fmt(top.amount)} (${share}%). Trimming it by 15% would free up about ${fmt(trim)} this month.`,
      highlight: ranked.length === 1
        ? "Spread essentials across categories so one area doesn't dominate."
        : ranked[1]
          ? `Next up: ${ranked[1].name} at ${fmt(ranked[1].amount)}.`
          : undefined,
      action: ranked.length > 1 ? `Try a ${top.name} cap of ${fmt(cap)} next month` : undefined,
    });
  }

  if (ranked.length >= 3) {
    cards.push({
      id: 'mix',
      body: `Your top three categories this month: ${ranked.slice(0, 3).map(r => `${r.name} (${fmt(r.amount)})`).join(', ')}.`,
      highlight: 'A healthy mix usually means no single category over ~40% of spend.',
    });
  }

  if (budget > 0 && spent > budget) {
    cards.push({
      id: 'over',
      body: `You're ${fmt(spent - budget)} over your ${fmt(budget)} monthly budget.`,
      highlight: 'Pause non-essentials for a few days to get back on track.',
    });
  } else if (budget > 0) {
    const left = budget - spent;
    const daysLeft = Math.max(days - day, 1);
    cards.push({
      id: 'left',
      body: `${fmt(left)} left in this month's budget with ${days - day} days remaining.`,
      highlight: `That's about ${fmt(Math.round(left / daysLeft))}/day if you want to finish on plan.`,
    });
  }

  if (earned > 0) {
    const saveRate = Math.round(((earned - spent) / earned) * 100);
    cards.push({
      id: 'cashflow',
      body: `Income logged ${fmt(earned)} vs spend ${fmt(spent)} — net ${fmt(earned - spent)}.`,
      highlight: saveRate >= 20
        ? `Nice — you're keeping about ${saveRate}% this month.`
        : saveRate >= 0
          ? `Saving rate is around ${saveRate}%. Even +5% helps.`
          : 'Spend is ahead of income logged so far — check missing income entries.',
    });
  }

  if (expenses.length > 0) {
    const biggest = [...expenses].sort((a, b) => b.amount - a.amount)[0];
    cards.push({
      id: 'largest',
      body: `Largest expense: ${biggest.description || 'Untitled'} at ${fmt(biggest.amount)}.`,
      highlight: expenses.length >= 5
        ? `Across ${expenses.length} expenses, average ticket is ${fmt(Math.round(spent / expenses.length))}.`
        : undefined,
    });
  }

  const weekdaySpend = [0, 0, 0, 0, 0, 0, 0];
  for (const t of expenses) {
    const [y, m, d] = t.date.slice(0, 10).split('-').map(Number);
    weekdaySpend[new Date(y, m - 1, d).getDay()] += t.amount;
  }
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  let peakDay = 0;
  for (let i = 1; i < 7; i++) if (weekdaySpend[i] > weekdaySpend[peakDay]) peakDay = i;
  if (weekdaySpend[peakDay] > 0) {
    cards.push({
      id: 'weekday',
      body: `${dayNames[peakDay]} is your heaviest spend day so far (${fmt(weekdaySpend[peakDay])}).`,
      highlight: 'Plan grocery / dining budgets around that weekday to stay intentional.',
    });
  }

  const recurring = expenses.filter(t => t.recurringRuleId);
  if (recurring.length > 0) {
    const recSum = recurring.reduce((s, t) => s + t.amount, 0);
    cards.push({
      id: 'recurring',
      body: `${recurring.length} recurring charge${recurring.length === 1 ? '' : 's'} this month totaling ${fmt(recSum)}.`,
      highlight: 'Review recurring rules in Financial Tools if anything looks duplicated.',
    });
  }

  return cards;
}
