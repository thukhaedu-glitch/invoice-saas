// src/config/planLimits.js
// Plan အလိုက် feature limit + price (MMK)
// "documents" = invoice + quotation ပေါင်း (per month)
// -1 = Unlimited

export const PLAN_LIMITS = {
  // signup အသစ်တွေ free trial — paid မဖြစ်မချင်း
  free: {
    label: 'Free Trial',
    documents: 10,
    customers: 25,
    members: 2,
    price: 0,
  },
  starter: {
    label: 'Starter',
    documents: 100,
    customers: 200,
    members: 3,
    price: 49900,
  },
  growth: {
    label: 'Growth',
    documents: 500,
    customers: 1000,
    members: 10,
    price: 69900,
  },
  business: {
    label: 'Business',
    documents: -1,
    customers: -1,
    members: -1,
    price: 89900,
  },
}

export const PAID_PLANS = ['starter', 'growth', 'business']

export function normalizePlan(plan) {
  if (!plan) return 'free'
  const p = String(plan).toLowerCase()
  if (p === 'free' || p === 'trial') return 'free'
  if (p === 'starter') return 'starter'
  if (p === 'growth') return 'growth'
  if (p === 'business') return 'business'
  return 'free'
}

export function getLimit(plan, feature) {
  const key = normalizePlan(plan)
  return PLAN_LIMITS[key]?.[feature] ?? 0
}

export function canAdd(plan, feature, currentCount) {
  const limit = getLimit(plan, feature)
  if (limit === -1) return true
  return currentCount < limit
}

export function limitText(plan, feature) {
  const limit = getLimit(plan, feature)
  return limit === -1 ? 'Unlimited' : String(limit)
}

export function planLabel(plan) {
  const key = normalizePlan(plan)
  return PLAN_LIMITS[key]?.label || 'Free Trial'
}

export function planPrice(plan) {
  const key = normalizePlan(plan)
  return PLAN_LIMITS[key]?.price || 0
}

export function formatMMK(amount) {
  return Number(amount || 0).toLocaleString('en-US') + ' MMK'
}
