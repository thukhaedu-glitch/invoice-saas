import { useState, useEffect, useMemo } from 'react'
import { db, auth } from '../firebase'
import { collection, onSnapshot, getDocs, query, where } from 'firebase/firestore'
import Layout from '../components/Layout'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { FileText, CheckCircle, Clock, AlertCircle, TrendingUp, TrendingDown, Wallet, Users, Briefcase, ArrowRight } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useRole } from '../hooks/useRole'

const months = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12']
const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

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
  const totalRevenue = useMemo(() => invoices.filter(i => getInvDate(i)?.startsWith(filterYear) && (i.status === 'paid' || i.status === 'partial')).reduce((s, i) => s + Number(i.paidAmount || i.totalAmount || 0), 0), [invoices, filterYear])
  const totalExpenses = useMemo(() => expenses.filter(e => e.date?.startsWith(filterYear)).reduce((s, e) => s + Number(e.amount || 0), 0), [expenses, filterYear])
  const netProfit = totalRevenue - totalExpenses
  const totalReceivable = invoices.filter(i => i.status === 'pending' || i.status === 'partial').reduce((s, i) => s + Number(i.remainingAmount || i.totalAmount || 0), 0)

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
    const cInvs = compareYear ? invoices.filter(i => getInvDate(i)?.startsWith(`${compareYear}-${m}`)) : []
    const cRevenue = cInvs.filter(i => i.status === 'paid' || i.status === 'partial').reduce((s, i) => s + Number(i.paidAmount || i.totalAmount || 0), 0)
    const cExpense = compareYear ? expenses.filter(e => e.date?.startsWith(`${compareYear}-${m}`)).reduce((s, e) => s + Number(e.amount || 0), 0) : 0
    return { month: monthNames[idx], revenue, expense, ...(compareYear ? { cRevenue, cExpense } : {}) }
  })

  const fmtK = v => v >= 1000000 ? `${(v / 1000000).toFixed(1)}M` : v >= 1000 ? `${(v / 1000).toFixed(0)}K` : v.toLocaleString()
  const top5Clients = useMemo(() => Object.entries(invoices.filter(i => i.status === 'paid' || i.status === 'partial').reduce((map, i) => { map[i.clientName] = (map[i.clientName] || 0) + Number(i.paidAmount || i.totalAmount || 0); return map }, {})).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, amount]) => ({ name, amount })), [invoices])
  const recentPayments = useMemo(() => invoices.flatMap(inv => (inv.payments || []).map(p => ({ ...p, invoiceNumber: inv.invoiceNumber, clientName: inv.clientName }))).sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 5), [invoices])
  const uniqueYears = [...new Set(invoices.map(i => getInvDate(i)?.slice(0, 4)).filter(Boolean))].sort().reverse()
  if (!uniqueYears.includes(new Date().getFullYear().toString())) uniqueYears.unshift(new Date().getFullYear().toString())

  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>Loading...</div>

  return (
    <Layout title="Dashboard">
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
        <div style={{ background: 'rgba(79,110,247,0.08)', border: '0.5px solid rgba(79,110,247,0.2)', borderRadius: 12, padding: '12px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <AlertCircle size={16} color="var(--primary)" />
            <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--primary)' }}>{adminApproved.length} invoice{adminApproved.length > 1 ? 's' : ''} waiting for final approval</span>
          </div>
          <button type="button" onClick={() => navigate('/invoices')} className="btn btn-primary" style={{ fontSize: 12, padding: '5px 12px' }}>Review Now</button>
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

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <h3 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-1)' }}>Overview — {filterYear}</h3>
        <select className="form-input" style={{ width: 'auto', fontSize: 12, padding: '5px 8px' }} value={filterYear} onChange={e => setFilterYear(e.target.value)}>
          {uniqueYears.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      <div className="stats-grid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
        {[
          { label: 'Total Revenue', value: totalRevenue, icon: TrendingUp, color: '#4F6EF7', bg: 'rgba(79,110,247,0.10)' },
          { label: 'Total Expenses', value: totalExpenses, icon: TrendingDown, color: '#dc2626', bg: 'rgba(220,38,38,0.10)' },
          { label: 'Net Profit', value: netProfit, icon: CheckCircle, color: netProfit >= 0 ? '#16a34a' : '#dc2626', bg: netProfit >= 0 ? 'rgba(22,163,74,0.10)' : 'rgba(220,38,38,0.10)' },
          { label: 'Receivable', value: totalReceivable, icon: Clock, color: '#d97706', bg: 'rgba(217,119,6,0.10)' },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="card" style={{ padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-2)' }}>{label}</span>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon size={16} color={color} />
              </div>
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, color, marginBottom: 2 }}>{value.toLocaleString()} Ks</div>
          </div>
        ))}
      </div>

      {bankAccounts.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))', gap: 12, marginBottom: 16 }}>
          {bankAccounts.map(a => (
            <div key={a.id} className="card" style={{ padding: 16, cursor: 'pointer' }} onClick={() => navigate('/bank-accounts')}>
              <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 4 }}>{a.bankName || a.type}</div>
              <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 6 }}>{a.name}</div>
              <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--primary)' }}>
                {Number(a.currentBalance || a.openingBalance || 0).toLocaleString()}
                <span style={{ fontSize: 11, color: 'var(--text-3)', marginLeft: 4 }}>{a.currency || 'MMK'}</span>
              </div>
            </div>
          ))}
          <div className="card" style={{ padding: 16, background: 'linear-gradient(135deg,#1a1d2e,#2d3260)', color: 'white', cursor: 'pointer' }} onClick={() => navigate('/bank-accounts')}>
            <div style={{ fontSize: 11, opacity: 0.7, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Balance</div>
            {Object.entries(balanceByCurrency).map(([cur, bal]) => (
              <div key={cur} style={{ marginBottom: 4 }}>
                <div style={{ fontSize: 11, opacity: 0.6 }}>{cur}</div>
                <div style={{ fontSize: 16, fontWeight: 700 }}>{bal.toLocaleString()} <span style={{ fontSize: 11, opacity: 0.7 }}>{cur}</span></div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card" style={{ padding: 20, marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
          <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-1)' }}>Income vs Expense — {filterYear}{compareYear ? ` vs ${compareYear}` : ''}</div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: 'var(--text-3)' }}>Compare with:</span>
            <select className="form-input" style={{ width: 'auto', fontSize: 12, padding: '4px 8px' }} value={compareYear} onChange={e => setCompareYear(e.target.value)}>
              <option value="">None</option>
              {uniqueYears.filter(y => y !== filterYear).map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#9aa0b4' }} axisLine={false} tickLine={false} />
            <YAxis tickFormatter={fmtK} tick={{ fontSize: 10, fill: '#9aa0b4' }} axisLine={false} tickLine={false} width={45} />
            <Tooltip formatter={(value, name) => [`${value.toLocaleString()} Ks`, name]} labelStyle={{ fontWeight: 600, color: '#1a1d2e' }} contentStyle={{ borderRadius: 10, border: '0.5px solid #e2e8f0', fontSize: 12 }} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Line type="monotone" dataKey="revenue" name={`Income ${filterYear}`} stroke="#4F6EF7" strokeWidth={2.5} dot={{ r: 3, fill: '#4F6EF7' }} activeDot={{ r: 5 }} />
            <Line type="monotone" dataKey="expense" name={`Expense ${filterYear}`} stroke="#ef4444" strokeWidth={2.5} dot={{ r: 3, fill: '#ef4444' }} activeDot={{ r: 5 }} />
            {compareYear && <Line type="monotone" dataKey="cRevenue" name={`Income ${compareYear}`} stroke="#4F6EF7" strokeWidth={2} strokeDasharray="5 5" dot={{ r: 2 }} activeDot={{ r: 4 }} />}
            {compareYear && <Line type="monotone" dataKey="cExpense" name={`Expense ${compareYear}`} stroke="#ef4444" strokeWidth={2} strokeDasharray="5 5" dot={{ r: 2 }} activeDot={{ r: 4 }} />}
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="form-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        <div className="card" style={{ padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-1)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Users size={15} color="var(--primary)" />Top 5 Clients
            </div>
            <button type="button" onClick={() => navigate('/customers')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary)', fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}>
              View all<ArrowRight size={11} />
            </button>
          </div>
          {top5Clients.length === 0 ? <div style={{ textAlign: 'center', color: 'var(--text-3)', fontSize: 12, padding: 20 }}>No data yet</div>
            : top5Clients.map((c, i) => {
              const maxAmt = top5Clients[0]?.amount || 1
              return (
                <div key={c.name} style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifycontent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ width: 18, height: 18, borderRadius: '50%', background: 'var(--primary-light)', color: 'var(--primary)', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifycontent: 'center' }}>{i + 1}</span>
                      <span style={{ fontWeight: 500 }}>{c.name}</span>
                    </div>
                    <span style={{ fontWeight: 600, color: '#16a34a', fontSize: 12 }}>{c.amount.toLocaleString()} Ks</span>
                  </div>
                  <div style={{ height: 4, background: '#f1f5f9', borderRadius: 2 }}>
                    <div style={{ height: 4, borderRadius: 2, background: 'var(--primary)', width: `${Math.round(c.amount / maxAmt * 100)}%`, transition: 'width 0.3s' }} />
                  </div>
                </div>
              )
            })}
        </div>
        <div className="card" style={{ padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifycontent: 'space-between', marginBottom: 16 }}>
            <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-1)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <CheckCircle size={15} color="#16a34a" />Recent Payments
            </div>
            <button type="button" onClick={() => navigate('/invoices')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary)', fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}>
              View all<ArrowRight size={11} />
            </button>
          </div>
          {recentPayments.length === 0 ? <div style={{ textAlign: 'center', color: 'var(--text-3)', fontSize: 12, padding: 20 }}>No payments yet</div>
            : recentPayments.map((p, i) => (
              <div key={i} style={{ display: 'flex', justifycontent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '0.5px solid #f1f5f9' }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-1)' }}>{p.clientName}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 1 }}>{p.invoiceNumber} · {p.date}</div>
                </div>
                <span style={{ fontWeight: 600, color: '#16a34a', fontSize: 13 }}>{Number(p.amount).toLocaleString()} Ks</span>
              </div>
            ))}
        </div>
      </div>

      <div className="stats-grid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
        {[
          { label: 'Invoices', count: invoices.length, icon: FileText, color: '#4F6EF7', path: '/invoices' },
          { label: 'Customers', count: customers.length, icon: Users, color: '#16a34a', path: '/customers' },
          { label: 'Expenses', count: expenses.length, icon: Wallet, color: '#dc2626', path: '/expenses' },
          { label: 'Projects', count: projects.length, icon: Briefcase, color: '#8b5cf6', path: '/projects' },
        ].map(({ label, count, icon: Icon, color, path }) => (
          <div key={label} className="card" style={{ padding: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12 }} onClick={() => navigate(path)}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: `${color}15`, display: 'flex', alignItems: 'center', justifycontent: 'center', flexShrink: 0 }}>
              <Icon size={20} color={color} />
            </div>
            <div>
              <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-1)' }}>{count}</div>
              <div style={{ fontSize: 12, color: 'var(--text-2)' }}>{label}</div>
            </div>
          </div>
        ))}
      </div>
    </Layout>
  )
}
