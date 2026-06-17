import { useState, useEffect, useMemo } from 'react'
import { db, auth } from '../firebase'
import { collection, onSnapshot, getDocs, query, where } from 'firebase/firestore'
import Layout from '../components/Layout'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { FileText, AlertCircle, TrendingUp, Wallet, Users, ArrowRight, ArrowUpRight, ArrowDownRight, Landmark, Receipt, BarChart3, FilePlus, FileCheck, DollarSign, Layers, CreditCard, ChevronRight, MoreVertical, RotateCcw } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useRole } from '../hooks/useRole'

const months = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12']
const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

// Teal accent palette (matches reference mockup)
const TEAL = '#14b8a6'
const TEAL_BG = 'rgba(20,184,166,0.10)'

// Tiny inline SVG sparkline — no extra deps
function Sparkline({ data = [], color = TEAL, width = 80, height = 30 }) {
  const vals = data.length ? data : [0, 0]
  const max = Math.max(...vals, 1)
  const min = Math.min(...vals, 0)
  const range = max - min || 1
  const step = vals.length > 1 ? width / (vals.length - 1) : width
  const pts = vals.map((v, i) => {
    const x = i * step
    const y = height - ((v - min) / range) * height
    return `${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')
  const lastX = (vals.length - 1) * step
  const lastY = height - ((vals[vals.length - 1] - min) / range) * height
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ overflow: 'visible', display: 'block' }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={lastX} cy={lastY} r="2.6" fill={color} />
    </svg>
  )
}

export default function Dashboard() {
  const [dismissedBanners, setDismissedBanners] = useState(false)
  const [companyId, setCompanyId] = useState(null)
  const [subInfo, setSubInfo] = useState({ plan: 'free', end: '', cancelled: false })
  const [invoices, setInvoices] = useState([])
  const [bills, setBills] = useState([])
  const [expenses, setExpenses] = useState([])
  const [customers, setCustomers] = useState([])
  const [projects, setProjects] = useState([])
  const [bankAccounts, setBankAccounts] = useState([])
  const [loading, setLoading] = useState(true)
  const [filterYear, setFilterYear] = useState(new Date().getFullYear().toString())
  const [compareYear, setCompareYear] = useState('')
  const navigate = useNavigate()
  const { role } = useRole()

  useEffect(() => {
    const load = async () => {
      try {
        const snap = await getDocs(query(collection(db, 'companies'), where(`members.${auth.currentUser.uid}`, '!=', null)))
        if (!snap.empty) {
          const cid = snap.docs[0].id
          setCompanyId(cid)
          const cd = snap.docs[0].data()
          setSubInfo({ plan: cd.plan || 'free', end: cd.subscriptionEnd || '', cancelled: cd.subscriptionCancelled === true })
          const unsubs = []
          ;[
            { name: 'invoices', setter: setInvoices },
            { name: 'expenses', setter: setExpenses },
            { name: 'customers', setter: setCustomers },
            { name: 'projects', setter: setProjects },
          ].forEach(({ name, setter }) => {
            const u = onSnapshot(collection(db, 'companies', cid, name), snap =>
              setter(snap.docs.map(d => ({ id: d.id, ...d.data() }))))
            unsubs.push(u)
          })
          const [baSnap, billSnap] = await Promise.all([
            getDocs(collection(db, 'companies', cid, 'bankAccounts')),
            getDocs(collection(db, 'companies', cid, 'bills')),
          ])
          setBankAccounts(baSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter(a => a.isActive !== false))
          setBills(billSnap.docs.map(d => ({ id: d.id, ...d.data() })))
          setLoading(false)
          return () => unsubs.forEach(u => u())
        }
      } catch (e) { console.error(e) }
      setLoading(false)
    }
    load()
  }, [])

  const getInvDate = inv => inv.date || (inv.createdAt?.seconds ? new Date(inv.createdAt.seconds * 1000).toISOString().split('T')[0] : null)
  // Bill ကို expense အဖြစ် ရေတွက်ဖို့ — billDate အလိုက်
  const getBillDate = b => b.billDate || b.date || b.dueDate || (b.createdAt?.seconds ? new Date(b.createdAt.seconds * 1000).toISOString().split('T')[0] : null)
  const totalRevenue = useMemo(() => invoices.filter(i => getInvDate(i)?.startsWith(filterYear) && (i.status === 'paid' || i.status === 'partial')).reduce((s, i) => s + Number(i.paidAmount || i.totalAmount || 0), 0), [invoices, filterYear])
  // Refund — refunded invoice တွေ (revenue ကနေ ဖြုတ်)
  const totalRefund = useMemo(() => invoices.filter(i => getInvDate(i)?.startsWith(filterYear) && i.status === 'refunded').reduce((s, i) => s + Number(i.paidAmount || i.totalAmount || 0), 0), [invoices, filterYear])
  const netRevenue = totalRevenue - totalRefund
  // Total Expenses = expenses collection + vendor bills (amount အပြည့်)
  const totalExpenses = useMemo(() => {
    const exp = expenses.filter(e => e.date?.startsWith(filterYear)).reduce((s, e) => s + Number(e.amount || 0), 0)
    const billExp = bills.filter(b => getBillDate(b)?.startsWith(filterYear)).reduce((s, b) => s + Number(b.amount || 0), 0)
    return exp + billExp
  }, [expenses, bills, filterYear])
  const netProfit = netRevenue - totalExpenses
  const totalReceivable = invoices.filter(i => i.status === 'pending' || i.status === 'partial').reduce((s, i) => s + Number(i.remainingAmount || i.totalAmount || 0), 0)
  // Liabilities — မပေးရသေးတဲ့ bills (Accounts Payable)
  const totalLiabilities = bills.filter(b => b.status === 'unpaid' || b.status === 'partial').reduce((s, b) => s + Number(b.remainingAmount || b.amount || 0), 0)

  const balanceByCurrency = {}
  bankAccounts.forEach(a => {
    const cur = a.currency || 'MMK'
    if (!balanceByCurrency[cur]) balanceByCurrency[cur] = 0
    balanceByCurrency[cur] += Number(a.currentBalance || a.openingBalance || 0)
  })

  const pendingApproval = invoices.filter(i => i.status === 'pending_approval')
  const adminApproved = invoices.filter(i => i.status === 'admin_approved')
  const today = new Date().toISOString().split('T')[0]
  const overdueBills = bills.filter(b => (b.status === 'unpaid' || b.status === 'partial') && b.dueDate && b.dueDate < today)
  const overdueBillsTotal = overdueBills.reduce((s, b) => s + Number(b.remainingAmount || b.amount || 0), 0)
  const overdueInvoices = invoices.filter(i => i.status === 'overdue' || ((i.status === 'pending' || i.status === 'partial') && i.dueDate && i.dueDate < today))
  const overdueInvoicesTotal = overdueInvoices.reduce((s, i) => s + Number(i.remainingAmount || i.totalAmount || 0), 0)

  const chartData = months.map((m, idx) => {
    const mInvs = invoices.filter(i => getInvDate(i)?.startsWith(`${filterYear}-${m}`))
    const revenue = mInvs.filter(i => i.status === 'paid' || i.status === 'partial').reduce((s, i) => s + Number(i.paidAmount || i.totalAmount || 0), 0)
    const expense = expenses.filter(e => e.date?.startsWith(`${filterYear}-${m}`)).reduce((s, e) => s + Number(e.amount || 0), 0)
      + bills.filter(b => getBillDate(b)?.startsWith(`${filterYear}-${m}`)).reduce((s, b) => s + Number(b.amount || 0), 0)
    const cInvs = compareYear ? invoices.filter(i => getInvDate(i)?.startsWith(`${compareYear}-${m}`)) : []
    const cRevenue = cInvs.filter(i => i.status === 'paid' || i.status === 'partial').reduce((s, i) => s + Number(i.paidAmount || i.totalAmount || 0), 0)
    const cExpense = compareYear ? (expenses.filter(e => e.date?.startsWith(`${compareYear}-${m}`)).reduce((s, e) => s + Number(e.amount || 0), 0)
      + bills.filter(b => getBillDate(b)?.startsWith(`${compareYear}-${m}`)).reduce((s, b) => s + Number(b.amount || 0), 0)) : 0
    return { month: monthNames[idx], revenue, expense, ...(compareYear ? { cRevenue, cExpense } : {}) }
  })

  const fmtK = v => v >= 1000000 ? `${(v / 1000000).toFixed(1)}M` : v >= 1000 ? `${(v / 1000).toFixed(0)}K` : v.toLocaleString()
  const top5Clients = useMemo(() => Object.entries(invoices.filter(i => i.status === 'paid' || i.status === 'partial').reduce((map, i) => { map[i.clientName] = (map[i.clientName] || 0) + Number(i.paidAmount || i.totalAmount || 0); return map }, {})).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, amount]) => ({ name, amount })), [invoices])
  const recentPayments = useMemo(() => invoices.flatMap(inv => (inv.payments || []).map(p => ({ ...p, invoiceNumber: inv.invoiceNumber, clientName: inv.clientName }))).sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 5), [invoices])
  const uniqueYears = [...new Set(invoices.map(i => getInvDate(i)?.slice(0, 4)).filter(Boolean))].sort().reverse()
  if (!uniqueYears.includes(new Date().getFullYear().toString())) uniqueYears.unshift(new Date().getFullYear().toString())

  // ===== Redesign-only derived data (calc မထိ — display အတွက်ပဲ) =====
  const refIdx = useMemo(() => {
    if (filterYear === new Date().getFullYear().toString()) return new Date().getMonth()
    let last = 0
    chartData.forEach((d, i) => { if (d.revenue || d.expense) last = i })
    return last
  }, [chartData, filterYear])
  const revSeries = chartData.map(d => d.revenue)
  const expSeries = chartData.map(d => d.expense)
  const profitSeries = chartData.map(d => d.revenue - d.expense)
  const recvSeries = months.map(m => invoices.filter(i => getInvDate(i)?.startsWith(`${filterYear}-${m}`) && (i.status === 'pending' || i.status === 'partial')).reduce((s, i) => s + Number(i.remainingAmount || i.totalAmount || 0), 0))
  const refundSeries = months.map(m => invoices.filter(i => getInvDate(i)?.startsWith(`${filterYear}-${m}`) && i.status === 'refunded').reduce((s, i) => s + Number(i.paidAmount || i.totalAmount || 0), 0))
  const momPct = (arr) => {
    const cur = arr[refIdx] || 0
    const prev = refIdx > 0 ? (arr[refIdx - 1] || 0) : 0
    if (!prev) return cur > 0 ? 100 : 0
    return ((cur - prev) / prev) * 100
  }

  // Bank vs Credit Card split (Account Summary)
  const isCard = a => /credit|card/i.test(`${a.type || ''} ${a.accountType || ''}`)
  const bankTotal = bankAccounts.filter(a => !isCard(a)).reduce((s, a) => s + Number(a.currentBalance || a.openingBalance || 0), 0)
  const cardTotal = bankAccounts.filter(a => isCard(a)).reduce((s, a) => s + Number(a.currentBalance || a.openingBalance || 0), 0)

  // Invoice status counts — donut (priority: overdue > paid > draft > pending)
  const classify = i => {
    const od = i.status === 'overdue' || ((i.status === 'pending' || i.status === 'partial') && i.dueDate && i.dueDate < today)
    if (od) return 'overdue'
    if (i.status === 'paid' || i.status === 'partial') return 'paid'
    if (i.status === 'draft') return 'draft'
    return 'pending'
  }
  const statusCount = { paid: 0, pending: 0, overdue: 0, draft: 0 }
  invoices.forEach(i => { const k = classify(i); if (statusCount[k] !== undefined) statusCount[k]++ })
  const donutData = [
    { name: 'Paid', value: statusCount.paid, color: TEAL },
    { name: 'Pending', value: statusCount.pending, color: '#3b82f6' },
    { name: 'Overdue', value: statusCount.overdue, color: '#f59e0b' },
    { name: 'Draft', value: statusCount.draft, color: '#cbd5e1' },
  ]
  const donutTotal = donutData.reduce((s, d) => s + d.value, 0)
  const donutNonZero = donutData.filter(d => d.value > 0)

  // Recent transactions — invoices + bills, newest first
  const recentTx = useMemo(() => {
    const inv = invoices.map(i => ({
      date: getInvDate(i), desc: `Invoice #${i.invoiceNumber || ''}`.trim(), party: i.clientName || '—',
      type: 'Invoice', amount: Number(i.totalAmount || 0), status: classify(i),
    }))
    const bill = bills.map(b => ({
      date: b.date || b.billDate || b.dueDate, desc: `Bill #${b.billNumber || ''}`.trim(), party: b.vendor || b.vendorName || '—',
      type: 'Bill', amount: -Number(b.amount || 0),
      status: b.status === 'paid' ? 'paid' : (b.dueDate && b.dueDate < today ? 'overdue' : 'pending'),
    }))
    return [...inv, ...bill].filter(t => t.date).sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 6)
  }, [invoices, bills])

  const statusBadge = { paid: ['badge-success', '#16a34a', 'Paid'], pending: ['badge-warning', '#d97706', 'Pending'], overdue: ['badge-danger', '#dc2626', 'Overdue'], draft: ['badge-gray', '#9aa0b4', 'Draft'] }
  const typeBadge = { Invoice: 'badge-info', Bill: 'badge-gray', Payment: 'badge-success' }

  const statCards = [
    { label: 'Total Revenue', value: netRevenue, icon: DollarSign, series: revSeries, delta: momPct(revSeries), invert: false },
    { label: 'Total Expenses', value: totalExpenses, icon: Wallet, series: expSeries, delta: momPct(expSeries), invert: true },
    { label: 'Net Profit', value: netProfit, icon: TrendingUp, series: profitSeries, delta: momPct(profitSeries), invert: false },
    { label: 'Outstanding', value: totalReceivable, icon: Layers, series: recvSeries, delta: momPct(recvSeries), invert: false },
    { label: 'Refunds', value: totalRefund, icon: RotateCcw, series: refundSeries, delta: momPct(refundSeries), invert: true },
  ]

  const accountRows = [
    { label: 'Bank Accounts', value: bankTotal, icon: Landmark, path: '/bank-accounts' },
    { label: 'Credit Cards', value: cardTotal, icon: CreditCard, path: '/bank-accounts' },
    { label: 'Accounts Receivable', value: totalReceivable, icon: Users, path: '/invoices' },
    { label: 'Accounts Payable', value: totalLiabilities, icon: Receipt, path: '/bills' },
  ]

  const quickActions = [
    { label: 'New Invoice', icon: FilePlus, path: '/create-invoice' },
    { label: 'New Quotation', icon: FileCheck, path: '/create-quotation' },
    { label: 'Add Expense', icon: Wallet, path: '/expenses' },
    { label: 'Reports', icon: BarChart3, path: '/reports' },
  ]

  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>Loading...</div>

  return (
    <Layout title="Dashboard">
      <style>{`
        .dash-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(185px,1fr));gap:16px;margin-bottom:16px}
        .dash-mid{display:grid;grid-template-columns:1.6fr 1.3fr 1fr;gap:16px;margin-bottom:16px}
        .dash-bot{display:grid;grid-template-columns:2.4fr 1fr;gap:16px;margin-bottom:16px}
        .dash-qa{display:grid;grid-template-columns:repeat(2,1fr);gap:12px}
        @media(max-width:1100px){.dash-mid{grid-template-columns:1fr 1fr}.dash-bot{grid-template-columns:1fr}}
        @media(max-width:780px){.dash-mid{grid-template-columns:1fr}}
      `}</style>

      {/* Subscription expiring warning */}
      {(() => {
        const d = subInfo.end ? Math.ceil((new Date(subInfo.end + 'T23:59:59') - new Date()) / (1000 * 60 * 60 * 24)) : null
        const expiring = subInfo.plan !== 'free' && d !== null && d <= 7 && d >= 0
        if (!expiring) return null
        return (
          <div style={{ background: subInfo.cancelled ? '#fcebeb' : '#faeeda', border: `0.5px solid ${subInfo.cancelled ? '#dc2626' : '#f59e0b'}`, borderRadius: 12, padding: '12px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <AlertCircle size={16} color={subInfo.cancelled ? '#dc2626' : '#d97706'} />
              <span style={{ fontSize: 13, fontWeight: 600, color: subInfo.cancelled ? '#dc2626' : '#d97706' }}>
                {d === 0 ? 'Subscription ဒီနေ့ ကုန်မယ်!' : `Subscription ${d} ရက် အတွင်း ကုန်မယ်`} — Please resubscribe
              </span>
            </div>
            <button onClick={() => navigate('/upgrade')} style={{ background: subInfo.cancelled ? '#dc2626' : '#d97706', color: 'white', border: 'none', borderRadius: 8, padding: '6px 14px', fontWeight: 600, fontSize: 12, cursor: 'pointer' }}>Resubscribe</button>
          </div>
        )
      })()}
      {/* Approval banners */}
      {role === 'admin' && pendingApproval.length > 0 && (
        <div style={{ background: 'rgba(22,163,74,0.08)', border: '0.5px solid rgba(22,163,74,0.2)', borderRadius: 12, padding: '12px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <AlertCircle size={16} color="#16a34a" />
            <span style={{ fontSize: 13, fontWeight: 500, color: '#16a34a' }}>{pendingApproval.length} invoice{pendingApproval.length > 1 ? 's' : ''} waiting for your approval</span>
          </div>
          <button type="button" onClick={() => navigate('/invoices')} className="btn btn-primary" style={{ fontSize: 12, padding: '5px 12px', background: '#16a34a', boxShadow: 'none' }}>Review Now</button>
        </div>
      )}
      {role === 'owner' && adminApproved.length > 0 && (
        <div style={{ background: 'rgba(20,184,166,0.08)', border: '0.5px solid rgba(20,184,166,0.2)', borderRadius: 12, padding: '12px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <AlertCircle size={16} color={TEAL} />
            <span style={{ fontSize: 13, fontWeight: 500, color: TEAL }}>{adminApproved.length} invoice{adminApproved.length > 1 ? 's' : ''} waiting for final approval</span>
          </div>
          <button type="button" onClick={() => navigate('/invoices')} className="btn" style={{ fontSize: 12, padding: '5px 12px', background: TEAL, color: '#fff' }}>Review Now</button>
        </div>
      )}

      {/* Overdue Summary Banner */}
      {!dismissedBanners && (
        <div style={{ background: overdueBills.length > 0 || overdueInvoices.length > 0 ? 'rgba(220,38,38,0.06)' : 'rgba(22,163,74,0.06)', border: `0.5px solid ${overdueBills.length > 0 || overdueInvoices.length > 0 ? 'rgba(220,38,38,0.2)' : 'rgba(22,163,74,0.2)'}`, borderRadius: 12, padding: '12px 16px', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: overdueBills.length > 0 || overdueInvoices.length > 0 ? 8 : 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <AlertCircle size={16} color={overdueBills.length > 0 || overdueInvoices.length > 0 ? '#dc2626' : '#16a34a'} />
              <span style={{ fontSize: 13, fontWeight: 600, color: overdueBills.length > 0 || overdueInvoices.length > 0 ? '#dc2626' : '#16a34a' }}>
                {overdueBills.length === 0 && overdueInvoices.length === 0 ? '✓ No overdue bills or invoices' : 'Overdue Alert'}
              </span>
            </div>
            <button type="button" onClick={() => setDismissedBanners(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', fontSize: 18, lineHeight: 1, padding: '0 4px' }}>×</button>
          </div>
          {overdueBills.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0', borderTop: '0.5px solid rgba(220,38,38,0.1)' }}>
              <span style={{ fontSize: 12, color: '#dc2626' }}>🔴 {overdueBills.length} overdue bill{overdueBills.length > 1 ? 's' : ''} — {overdueBillsTotal.toLocaleString()} Ks</span>
              <button type="button" onClick={() => navigate('/bills')} style={{ background: '#dc2626', color: 'white', border: 'none', borderRadius: 6, padding: '3px 10px', fontSize: 11, cursor: 'pointer', fontWeight: 500 }}>View</button>
            </div>
          )}
          {overdueInvoices.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0', borderTop: '0.5px solid rgba(217,119,6,0.1)' }}>
              <span style={{ fontSize: 12, color: '#d97706' }}>🟡 {overdueInvoices.length} overdue invoice{overdueInvoices.length > 1 ? 's' : ''} — {overdueInvoicesTotal.toLocaleString()} Ks</span>
              <button type="button" onClick={() => navigate('/invoices')} style={{ background: '#d97706', color: 'white', border: 'none', borderRadius: 6, padding: '3px 10px', fontSize: 11, cursor: 'pointer', fontWeight: 500 }}>View</button>
            </div>
          )}
        </div>
      )}

      {/* Stat cards — icon (left) + value + MoM% + sparkline */}
      <div className="dash-stats">
        {statCards.map(({ label, value, icon: Icon, series, delta, invert }) => {
          const up = delta >= 0
          const good = invert ? !up : up
          const deltaColor = good ? '#16a34a' : '#dc2626'
          return (
            <div key={label} className="card" style={{ padding: 18 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ width: 52, height: 52, borderRadius: '50%', background: TEAL_BG, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Icon size={22} color={TEAL} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, color: 'var(--text-2)', marginBottom: 3 }}>{label}</div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-1)', lineHeight: 1.1, whiteSpace: 'nowrap' }}>{Math.round(value).toLocaleString()} <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-3)' }}>Ks</span></div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 14, gap: 8 }}>
                <div>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 12.5, fontWeight: 600, color: deltaColor }}>
                    {up ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}{Math.abs(delta).toFixed(1)}%
                  </span>
                  <div style={{ fontSize: 11, color: 'var(--text-3)' }}>vs last month</div>
                </div>
                <Sparkline data={series} color={TEAL} />
              </div>
            </div>
          )
        })}
      </div>

      {/* Middle row: Revenue Overview + Invoice Status + Account Summary */}
      <div className="dash-mid">
        {/* Revenue Overview */}
        <div className="card" style={{ padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6, flexWrap: 'wrap', gap: 8 }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-1)' }}>Revenue Overview</div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {compareYear && <span style={{ fontSize: 11, color: 'var(--text-3)' }}>vs {compareYear}</span>}
              <select className="form-input" style={{ width: 'auto', fontSize: 12, padding: '5px 10px' }} value={filterYear} onChange={e => setFilterYear(e.target.value)}>
                {uniqueYears.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
              <select className="form-input" style={{ width: 'auto', fontSize: 12, padding: '5px 10px' }} value={compareYear} onChange={e => setCompareYear(e.target.value)}>
                <option value="">Compare…</option>
                {uniqueYears.filter(y => y !== filterYear).map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 16, marginBottom: 8 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-2)' }}><span style={{ width: 14, height: 3, borderRadius: 2, background: TEAL }} />Revenue</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-2)' }}><span style={{ width: 14, height: 3, borderRadius: 2, background: '#5eead4' }} />Expenses</span>
          </div>
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="gRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={TEAL} stopOpacity={0.30} />
                  <stop offset="100%" stopColor={TEAL} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#eef1f6" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#9aa0b4' }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={fmtK} tick={{ fontSize: 10, fill: '#9aa0b4' }} axisLine={false} tickLine={false} width={48} />
              <Tooltip formatter={(value, name) => [`${Number(value).toLocaleString()} Ks`, name]} labelStyle={{ fontWeight: 600, color: '#1a1d2e' }} contentStyle={{ borderRadius: 10, border: '0.5px solid #e2e8f0', fontSize: 12 }} />
              <Area type="monotone" dataKey="revenue" name="Revenue" stroke={TEAL} strokeWidth={2.6} fill="url(#gRevenue)" dot={false} activeDot={{ r: 5 }} />
              <Area type="monotone" dataKey="expense" name="Expenses" stroke="#5eead4" strokeWidth={2} strokeDasharray="5 4" fill="none" dot={false} activeDot={{ r: 4 }} />
              {compareYear && <Area type="monotone" dataKey="cRevenue" name={`Revenue ${compareYear}`} stroke="#94a3b8" strokeWidth={1.6} strokeDasharray="2 3" fill="none" dot={false} />}
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Invoice Status */}
        <div className="card" style={{ padding: 20, display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-1)', marginBottom: 12 }}>Invoice Status</div>
          {donutTotal === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--text-3)', fontSize: 12, padding: '48px 0' }}>No invoices yet</div>
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1 }}>
                <div style={{ position: 'relative', width: 150, height: 150, flexShrink: 0 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={donutNonZero} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={70} paddingAngle={2} stroke="none">
                        {donutNonZero.map((d, i) => <Cell key={i} fill={d.color} />)}
                      </Pie>
                      <Tooltip formatter={(value, name) => [`${value}`, name]} contentStyle={{ borderRadius: 10, border: '0.5px solid #e2e8f0', fontSize: 12 }} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                    <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--text-1)', lineHeight: 1 }}>{donutTotal}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-3)' }}>Total</div>
                  </div>
                </div>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {donutData.map(d => (
                    <div key={d.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12.5 }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 7, color: 'var(--text-2)' }}>
                        <span style={{ width: 9, height: 9, borderRadius: '50%', background: d.color }} />{d.name}
                      </span>
                      <span style={{ color: 'var(--text-2)' }}>{d.value} <span style={{ color: 'var(--text-3)' }}>({donutTotal ? Math.round(d.value / donutTotal * 100) : 0}%)</span></span>
                    </div>
                  ))}
                </div>
              </div>
              <button type="button" onClick={() => navigate('/invoices')} style={{ marginTop: 14, paddingTop: 12, borderTop: '0.5px solid #f1f5f9', background: 'none', border: 'none', cursor: 'pointer', color: TEAL, fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                View all invoices<ArrowRight size={13} />
              </button>
            </>
          )}
        </div>

        {/* Account Summary */}
        <div className="card" style={{ padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-1)' }}>Account Summary</div>
            <MoreVertical size={16} color="var(--text-3)" />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {accountRows.map(({ label, value, icon: Icon, path }) => (
              <div key={label} onClick={() => navigate(path)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 0', borderBottom: '0.5px solid #f1f5f9', cursor: 'pointer' }}>
                <span style={{ width: 38, height: 38, borderRadius: 10, background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Icon size={17} color="#475569" />
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11.5, color: 'var(--text-3)' }}>{label}</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-1)' }}>{Math.round(value).toLocaleString()} <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-3)' }}>Ks</span></div>
                </div>
                <ChevronRight size={16} color="var(--text-3)" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom row: Recent Transactions + Quick Actions */}
      <div className="dash-bot">
        {/* Recent Transactions */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px' }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-1)' }}>Recent Transactions</div>
            <button type="button" onClick={() => navigate('/invoices')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: TEAL, fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>View all<ArrowRight size={12} /></button>
          </div>
          {recentTx.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--text-3)', fontSize: 12, padding: 28 }}>No transactions yet</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Description</th>
                    <th>Customer / Vendor</th>
                    <th>Type</th>
                    <th style={{ textAlign: 'right' }}>Amount</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recentTx.map((t, i) => {
                    const [badgeCls, , statusText] = statusBadge[t.status] || statusBadge.pending
                    return (
                      <tr key={i}>
                        <td style={{ color: 'var(--text-2)', whiteSpace: 'nowrap' }}>{t.date}</td>
                        <td>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 9 }}>
                            <span style={{ width: 28, height: 28, borderRadius: '50%', background: TEAL_BG, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                              <FileText size={14} color={TEAL} />
                            </span>
                            <span style={{ fontWeight: 500, color: 'var(--text-1)' }}>{t.desc}</span>
                          </span>
                        </td>
                        <td style={{ color: 'var(--text-2)' }}>{t.party}</td>
                        <td><span className={`badge ${typeBadge[t.type] || 'badge-gray'}`}>{t.type}</span></td>
                        <td style={{ textAlign: 'right', fontWeight: 600, color: t.amount < 0 ? '#dc2626' : 'var(--text-1)', whiteSpace: 'nowrap' }}>{t.amount < 0 ? '−' : ''}{Math.abs(Math.round(t.amount)).toLocaleString()} Ks</td>
                        <td><span className={`badge ${badgeCls}`}>{statusText}</span></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="card" style={{ padding: 20 }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-1)', marginBottom: 16 }}>Quick Actions</div>
          <div className="dash-qa">
            {quickActions.map(({ label, icon: Icon, path }) => (
              <button key={label} type="button" onClick={() => navigate(path)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '18px 8px', borderRadius: 14, border: '0.5px solid var(--border)', background: '#f8fafc', cursor: 'pointer', transition: 'all 0.15s' }}
                onMouseEnter={e => { e.currentTarget.style.background = TEAL_BG; e.currentTarget.style.borderColor = 'rgba(20,184,166,0.4)'; e.currentTarget.style.transform = 'translateY(-2px)' }}
                onMouseLeave={e => { e.currentTarget.style.background = '#f8fafc'; e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.transform = 'none' }}>
                <Icon size={22} color={TEAL} />
                <span style={{ fontSize: 11.5, fontWeight: 500, color: 'var(--text-2)', textAlign: 'center' }}>{label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </Layout>
  )
}
