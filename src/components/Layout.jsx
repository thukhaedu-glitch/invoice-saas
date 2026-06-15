import React, { useState, useEffect } from 'react'
import { auth, db } from '../firebase'
import { signOut } from 'firebase/auth'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { FileText, FileCheck, ScrollText, Users, Wallet, Briefcase, BarChart2, User, Settings, LogOut, Menu, X, BookOpen, Landmark, LayoutDashboard, Receipt, GitCompare, BookMarked, PieChart, Shield, Crown } from 'lucide-react'
import { getDocs, collection, query, where } from 'firebase/firestore'
import { usePlans } from '../hooks/usePlans'
import Notifications from './Notifications'
import LanguageSwitcher from './LanguageSwitcher'
import { useNotifications } from '../hooks/useNotifications'
import { useRecurring } from '../hooks/useRecurring'
import { useRole } from '../hooks/useRole'
// မှတ်ချက် - logAction function ဘယ်ကလာသလဲပေါ်မူတည်ပြီး အောက်ကလမ်းကြောင်းကို ပြင်ပေးပါ
// import { logAction } from '../utils/auditLog' 

const NAV_MAIN = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/invoices', label: 'Invoices', icon: FileText },
  { path: '/quotations', label: 'Quotations', icon: FileCheck },
  { path: '/contracts', label: 'Contracts', icon: ScrollText },
  { path: '/customers', label: 'Customers', icon: Users },
  { path: '/expenses', label: 'Expenses', icon: Wallet },
  { path: '/projects', label: 'Projects', icon: Briefcase },
  { path: '/custom-dashboard', label: 'My Dashboard', icon: PieChart },
  { path: '/report-builder', label: 'Report Builder', icon: BarChart2 },
]

const AnkoraLogo = () => (
  <img src="/ankora_x_logo_2.png" alt="AnkoraX" width="34" height="34" style={{ borderRadius: 10, objectFit: 'contain' }} />
)

export default function Layout({ children, title }) {
  const [open, setOpen] = useState(false)
  const [companyId, setCompanyId] = useState(null)
  const [plan, setPlan] = useState('free')
  const { planLabel } = usePlans()
  const location = useLocation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { canSettings, canReports } = useRole()

  useEffect(() => {
    const load = async () => {
      try {
        const snap = await getDocs(query(collection(db, 'companies'), where(`members.${auth.currentUser?.uid}`, '!=', null)))
        if (!snap.empty) {
          setCompanyId(snap.docs[0].id)
          setPlan(snap.docs[0].data().plan || 'free')
        }
      } catch (e) { }
    }
    load()
  }, [])

  useNotifications(companyId)
  useRecurring(companyId)

  const isActive = (item) => {
    if (!item.path) return false
    if (item.path === '/' && !item.tab) {
      return location.pathname === '/' && !searchParams.get('tab')
    }
    if (item.tab) {
      const currentTab = searchParams.get('tab') || ''
      return location.pathname === '/' && currentTab === item.tab
    }
    return location.pathname === item.path || location.pathname.startsWith(item.path + '/')
  }

  const handleNav = (item) => {
    if (!item.path) return
    if (item.tab) navigate(`/?tab=${item.tab}`)
    else navigate(item.path)
    setOpen(false)
  }

  // အသစ်ထည့်သွင်းထားသော Logout Function
  const handleLogout = async () => {
    try {
      if (companyId) {
        await logAction(companyId, {
          action: 'logout',
          module: 'auth',
          description: `User logged out: ${auth.currentUser?.email}`,
          metadata: {},
        })
      }
    } catch (e) { }
    await signOut(auth)
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      {open && <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 98 }} />}
      <aside className={`sidebar${open ? ' open' : ''}`}>
        <div style={{ padding: '20px 18px 16px', borderBottom: '0.5px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <AnkoraLogo />
            <div>
              <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-1)', letterSpacing: '0.02em' }}>Ankora<span style={{color: 'var(--primary)'}}>X</span></div>
              <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 1 }}>{auth.currentUser?.email}</div>
            </div>
          </div>
        </div>
        <nav style={{ flex: 1, padding: '12px 10px', overflowY: 'auto' }}>

          <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.07em', padding: '8px 8px 4px' }}>Main</div>
          {NAV_MAIN.map((item) => (
            <div key={item.path} className={`nav-item${isActive(item) ? ' active' : ''}`} onClick={() => handleNav(item)}>
              <item.icon size={17} /><span>{item.label}</span>
            </div>
          ))}

          {canReports && (
            <>
              <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.07em', padding: '12px 8px 4px', marginTop: 8 }}>Finance</div>
              <div className={`nav-item${location.pathname === '/chart-of-accounts' ? ' active' : ''}`} onClick={() => { navigate('/chart-of-accounts'); setOpen(false) }}>
                <BookOpen size={17} /><span>Chart of Accounts</span>
              </div>
              <div className={`nav-item${location.pathname === '/bank-accounts' ? ' active' : ''}`} onClick={() => { navigate('/bank-accounts'); setOpen(false) }}>
                <Landmark size={17} /><span>Bank Accounts</span>
              </div>
              <div className={`nav-item${location.pathname === '/journal-entries' ? ' active' : ''}`} onClick={() => { navigate('/journal-entries'); setOpen(false) }}>
                <BookMarked size={17} /><span>Journal Entries</span>
              </div>
              <div className={`nav-item${location.pathname === '/bills' ? ' active' : ''}`} onClick={() => { navigate('/bills'); setOpen(false) }}>
                <Receipt size={17} /><span>Bills & Payable</span>
              </div>
              <div className={`nav-item${location.pathname === '/reports' ? ' active' : ''}`} onClick={() => { navigate('/reports'); setOpen(false) }}>
                <BarChart2 size={17} /><span>Reports</span>
              </div>
              <div className={`nav-item${location.pathname.startsWith('/reconcile') ? ' active' : ''}`} onClick={() => { navigate('/bank-accounts'); setOpen(false) }}>
                <GitCompare size={17} /><span>Reconciliation</span>
              </div>
            </>
          )}

          <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.07em', padding: '12px 8px 4px', marginTop: 8 }}>Account</div>
          <div className={`nav-item${location.pathname === '/upgrade' ? ' active' : ''}`} onClick={() => { navigate('/upgrade'); setOpen(false) }} style={{ color: location.pathname === '/upgrade' ? undefined : '#8b5cf6' }}>
            <Crown size={17} /><span>Upgrade Plan</span>
          </div>
          <div className={`nav-item${location.pathname === '/profile' ? ' active' : ''}`} onClick={() => { navigate('/profile'); setOpen(false) }}>
            <User size={17} /><span>Profile</span>
          </div>
          {canSettings && (
            <div className={`nav-item${location.pathname === '/settings' ? ' active' : ''}`} onClick={() => { navigate('/settings'); setOpen(false) }}>
              <Settings size={17} /><span>Settings</span>
            </div>
          )}
          {canSettings && (
            <div className={`nav-item${location.pathname === '/audit-log' ? ' active' : ''}`} onClick={() => { navigate('/audit-log'); setOpen(false) }}>
              <Shield size={17} /><span>Audit Log</span>
            </div>
          )}
        </nav>

        <div style={{ padding: 10, borderTop: '0.5px solid var(--border)' }}>
          <div style={{ padding: '6px 8px', marginBottom: 6, fontSize: 11, color: 'var(--text-3)', textAlign: 'center' }}>
            Powered by <span style={{ fontWeight: 700, color: 'var(--primary)' }}>AnkoraX</span>
          </div>
          {/* အသစ်အစားထိုးထားသော Logout Button */}
          <div className="nav-item" style={{ color: '#ef4444' }} onClick={handleLogout}>
            <LogOut size={17} /><span>Logout</span>
          </div>
        </div>
      </aside>

      <div className="main-area">
        <div className="topbar">
          <button id="hamburger" onClick={() => setOpen(v => !v)} className="btn btn-ghost" style={{ padding: '6px 8px' }}>
            {open ? <X size={18} /> : <Menu size={18} />}
          </button>
          <div style={{ flex: 1, fontWeight: 500, fontSize: 15, color: 'var(--text-1)' }}>{title}</div>
          <LanguageSwitcher />
          <Notifications companyId={companyId} />
          <span style={{ fontSize: 11, background: 'var(--primary-light)', color: 'var(--primary)', padding: '3px 10px', borderRadius: 20, fontWeight: 600 }}>{planLabel(plan)}</span>
        </div>
        <div className="page-content">{children}</div>
      </div>
    </div>
  )
}
