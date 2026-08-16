import { Transaction } from './types';
import { getSpendCategories } from './spendCategories';
import { fmt } from './insights';

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

/** Local heuristic insights — matches AboutMoney-style pacing / category tips. */
export function buildAiInsights(
  monthTxns: Transaction[],
  budget: number,
  income: number,
  year: number,
  month: number,
): AiInsightCard[] {
  const expenses = monthTxns.filter(t => t.type === 'expense');
  const spent = expenses.reduce((s, t) => s + t.amount, 0);
  const cards: AiInsightCard[] = [];

  if (expenses.length === 0) {
    cards.push({
      id: 'empty',
      body: 'Add transactions to get AI insights.',
    });
    return cards;
  }

  const days = daysInMonth(year, month);
  const day = Math.min(dayOfMonth(), days);
  const perDay = spent / Math.max(day, 1);
  const projected = Math.round(perDay * days);

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
        : undefined,
      action: ranked.length > 1 ? `Set a ${top.name} cap of ${fmt(cap)} for next month` : undefined,
    });
  }

  if (budget > 0 && spent > budget) {
    cards.push({
      id: 'over',
      body: `You're ${fmt(spent - budget)} over your ${fmt(budget)} monthly budget.`,
      highlight: 'Pause non-essentials for a few days to get back on track.',
    });
  } else if (budget > 0) {
    cards.push({
      id: 'left',
      body: `${fmt(budget - spent)} left in this month's budget with ${days - day} days remaining.`,
    });
  }

  return cards;
}
