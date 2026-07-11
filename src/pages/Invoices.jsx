import { useState, useEffect, useMemo } from 'react'
import { db, auth } from '../firebase'
import { collection, onSnapshot, getDocs, query, where, doc, deleteDoc, updateDoc, addDoc, serverTimestamp, getDoc } from 'firebase/firestore'
import Layout from '../components/Layout'
import { FileText, Plus, CheckCircle, Clock, AlertCircle, Edit, Trash2, RefreshCcw, Link, Printer, CheckSquare, CopyPlus, DollarSign, X, Search, Mail, ThumbsUp, ThumbsDown, Download } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { sendInvoiceReminder } from '../utils/emailService'
import { useRole } from '../hooks/useRole'
import ConfirmPassword from '../components/ConfirmPassword'
import { logAction } from '../utils/auditLog'
import { syncPublicVerifications } from '../utils/publicVerification'
import React from 'react'

const months = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12']
const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export default function Invoices() {
  const [companyId, setCompanyId] = useState(null)
  const [invoices, setInvoices] = useState([])
  const [loading, setLoading] = useState(true)
  const [paymentModal, setPaymentModal] = useState(null)
  const [paymentForm, setPaymentForm] = useState({ amount: '', date: new Date().toISOString().split('T')[0], method: '', note: '' })
  const [savingPayment, setSavingPayment] = useState(false)
  const [paymentMethodOptions, setPaymentMethodOptions] = useState(['Cash', 'KBZ Pay', 'AYA Pay', 'Wave Pay', 'CB Pay', 'Bank Transfer', 'Other'])
  const [filterMonth, setFilterMonth] = useState('')
  const [filterYear, setFilterYear] = useState('')
  const [filterCustomer, setFilterCustomer] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [search, setSearch] = useState('')
  const [companyInfo, setCompanyInfo] = useState({})
  const [sendingReminder, setSendingReminder] = useState(null)
  const [confirmAction, setConfirmAction] = useState(null)
  const [managedBy, setManagedBy] = useState({})
  const [bankAccounts, setBankAccounts] = useState([])
  const [paymentBankAccountId, setPaymentBankAccountId] = useState('')
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [bulkLoading, setBulkLoading] = useState(false)
  const navigate = useNavigate()
  const { role, canEdit, canDelete, loading: roleLoading } = useRole()

  const canAdminApprove = (item) => {
    if (role === 'owner') return true
    if (role !== 'admin') return false
    const creatorUid = item.createdBy
    if (!creatorUid) return true
    return managedBy[creatorUid] === auth.currentUser.uid
  }

  useEffect(() => {
    const load = async () => {
      try {
        const snap = await getDocs(query(collection(db, 'companies'), where(`members.${auth.currentUser.uid}`, '!=', null)))
        if (!snap.empty) {
          const cid = snap.docs[0].id
          setCompanyId(cid)
          const cData = snap.docs[0].data()
          const publicCompanyName = cData.name || ''
          setManagedBy(cData.managedBy || {})
          const [sSnap, baSnap] = await Promise.all([
            getDoc(doc(db, 'companies', cid, '_config', 'invoiceSettings')),
            getDocs(collection(db, 'companies', cid, 'bankAccounts')),
          ])
          if (sSnap.exists()) {
            const sd = sSnap.data()
            if (sd.paymentMethods?.length) {
              const methods = sd.paymentMethods.map(m => m.bankName || m).filter(Boolean)
              if (methods.length) {
                setPaymentMethodOptions(methods)
                setPaymentForm(f => ({ ...f, method: methods[0] }))
              }
            }
            setCompanyInfo({
              name: sd.companyName || '',
              email: sd.companyEmail || '',
              phone: sd.companyPhone || '',
              paymentMethods: sd.paymentMethods?.map(m => `${m.bankName}: ${m.accountNo} (${m.accountName})`).join('\n') || ''
            })
          }
          setBankAccounts(baSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter(a => a.isActive !== false))
          const u = onSnapshot(collection(db, 'companies', cid, 'invoices'), snap => {
            const docs = snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))
            setInvoices(docs)
            syncPublicVerifications(cid, publicCompanyName, docs, 'invoice').catch(console.error)
            setLoading(false)
          })
          return u
        }
      } catch (e) { console.error(e) }
      setLoading(false)
    }
    load()
  }, [])

  const getInvDate = inv => inv.date || (inv.createdAt?.seconds ? new Date(inv.createdAt.seconds * 1000).toISOString().split('T')[0] : null)

  const filteredInvoices = useMemo(() => invoices.filter(inv => {
    const d = getInvDate(inv) || ''
    if (filterYear && !d.startsWith(filterYear)) return false
    if (filterMonth && filterYear && !d.startsWith(`${filterYear}-${filterMonth}`)) return false
    if (filterCustomer && inv.clientName !== filterCustomer) return false
    if (filterStatus && inv.status !== filterStatus) return false
    if (search && !inv.clientName?.toLowerCase().includes(search.toLowerCase()) && !inv.invoiceNumber?.toLowerCase().includes(search.toLowerCase())) return false
    return true
  }), [invoices, filterYear, filterMonth, filterCustomer, filterStatus, search])

  const uniqueYears = [...new Set(invoices.map(i => getInvDate(i)?.slice(0, 4)).filter(Boolean))].sort().reverse()
  const uniqueCustomers = [...new Set(invoices.map(i => i.clientName).filter(Boolean))].sort()

  const paid = invoices.filter(i => i.status === 'paid')
  const pending = invoices.filter(i => i.status === 'pending')
  const overdue = invoices.filter(i => i.status === 'overdue')
  const pendingApproval = invoices.filter(i => i.status === 'pending_approval' && canAdminApprove(i))
  const adminApproved = invoices.filter(i => i.status === 'admin_approved')

  const statsCards = [
    { label: 'Total', value: invoices.length, amount: invoices.reduce((s, i) => s + Number(i.totalAmount || 0), 0), color: '#4F6EF7', bg: 'rgba(79,110,247,0.10)' },
    { label: 'Paid', value: paid.length, amount: paid.reduce((s, i) => s + Number(i.totalAmount || 0), 0), color: '#16a34a', bg: 'rgba(22,163,74,0.10)' },
    { label: 'Pending', value: pending.length, amount: pending.reduce((s, i) => s + Number(i.totalAmount || 0), 0), color: '#d97706', bg: 'rgba(217,119,6,0.10)' },
    { label: 'Overdue', value: overdue.length, amount: overdue.reduce((s, i) => s + Number(i.totalAmount || 0), 0), color: '#dc2626', bg: 'rgba(220,38,38,0.10)' },
  ]

  const statusBadge = s => {
    const map = { paid: 'badge-success', partial: 'badge-info', refunded: 'badge-danger', pending: 'badge-warning', overdue: 'badge-danger', pending_approval: 'badge-gray', admin_approved: 'badge-info', rejected: 'badge-danger' }
    return <span className={`badge ${map[s] || 'badge-warning'}`}>
      {s === 'pending_approval' ? 'Needs Approval' : s === 'admin_approved' ? 'Admin Approved' : s === 'rejected' ? 'Rejected' : s || 'pending'}
    </span>
  }

  const toggleSelect = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredInvoices.length) setSelectedIds(new Set())
    else setSelectedIds(new Set(filteredInvoices.map(i => i.id)))
  }

  const clearSelection = () => setSelectedIds(new Set())
  const selectedInvoices = filteredInvoices.filter(i => selectedIds.has(i.id))
  const allSelected = filteredInvoices.length > 0 && selectedIds.size === filteredInvoices.length
  const someSelected = selectedIds.size > 0

  const handleBulkMarkPaid = async () => {
    if (!selectedIds.size) return
    if (!confirm(`Mark ${selectedIds.size} invoice(s) as paid?`)) return
    setBulkLoading(true)
    try {
      const today = new Date().toISOString().split('T')[0]
      for (const id of selectedIds) {
        const inv = invoices.find(i => i.id === id)
        if (!inv) continue
        await updateDoc(doc(db, 'companies', companyId, 'invoices', id), {
          status: 'paid', paidAmount: Number(inv.totalAmount || 0), remainingAmount: 0, lastPaymentDate: today,
        })
      }
      await logAction(companyId, {
        action: 'update', module: 'invoices',
        description: `Bulk marked ${selectedIds.size} invoice(s) as paid`,
        metadata: { count: selectedIds.size },
      })
      clearSelection()
    } catch (e) { alert(e.message) }
    setBulkLoading(false)
  }

  const handleBulkDelete = async () => {
    if (!selectedIds.size) return
    if (!canDelete) { alert('No permission to delete'); return }
    if (!confirm(`Delete ${selectedIds.size} invoice(s)?`)) return
    setBulkLoading(true)
    try {
      for (const id of selectedIds) {
        await deleteDoc(doc(db, 'companies', companyId, 'invoices', id))
      }
      await logAction(companyId, {
        action: 'delete', module: 'invoices',
        description: `Bulk deleted ${selectedIds.size} invoice(s)`,
        metadata: { count: selectedIds.size },
      })
      clearSelection()
    } catch (e) { alert(e.message) }
    setBulkLoading(false)
  }

  const handleBulkReminder = async () => {
    if (!selectedIds.size) return
    const withEmail = selectedInvoices.filter(i => i.clientEmail)
    if (!withEmail.length) { alert('No selected invoices have client email'); return }
    if (!confirm(`Send reminders to ${withEmail.length} client(s)?`)) return
    setBulkLoading(true)
    try {
      for (const item of withEmail) {
        await sendInvoiceReminder({
          clientName: item.clientName, clientEmail: item.clientEmail,
          invoiceNumber: item.invoiceNumber, amount: item.remainingAmount || item.totalAmount || 0,
          status: item.status, companyName: companyInfo.name, companyEmail: companyInfo.email,
          companyPhone: companyInfo.phone, paymentMethods: companyInfo.paymentMethods,
          invoiceLink: `${window.location.origin}/verify/${companyId}/${item.securityCode || item.id}`,
        })
      }
      await logAction(companyId, {
        action: 'send', module: 'invoices',
        description: `Bulk sent reminders to ${withEmail.length} client(s)`,
        metadata: { count: withEmail.length },
      })
      alert(`Reminders sent to ${withEmail.length} client(s) ✓`)
      clearSelection()
    } catch (e) { alert(e.message) }
    setBulkLoading(false)
  }

  const handleBulkExportCSV = () => {
    if (!selectedIds.size) return
    const data = selectedInvoices.map(i => ({
      'Invoice Number': i.invoiceNumber || '-',
      'Client': i.clientName || '-',
      'Total Amount': Number(i.totalAmount || 0),
      'Paid Amount': Number(i.paidAmount || 0),
      'Remaining': Number(i.remainingAmount || 0),
      'Status': i.status || '-',
      'Date': getInvDate(i) || '-',
      'Last Payment': i.lastPaymentDate || '-',
    }))
    const headers = Object.keys(data[0]).join(',')
    const rows = data.map(r => Object.values(r).map(v => `"${v}"`).join(',')).join('\n')
    const blob = new Blob([headers + '\n' + rows], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `invoices_export_${new Date().toISOString().split('T')[0]}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  const handleDelete = async (id) => {
    const inv = invoices.find(i => i.id === id)
    await deleteDoc(doc(db, 'companies', companyId, 'invoices', id))
    await logAction(companyId, {
      action: 'delete', module: 'invoices',
      description: `Deleted invoice: ${inv?.invoiceNumber || id} — ${inv?.clientName || ''}`,
      metadata: { invoiceId: id, invoiceNumber: inv?.invoiceNumber },
    })
  }

  const handleDeleteWithAuth = (id) => {
    if (roleLoading) return
    if (!canDelete) { alert('No permission to delete'); return }
    setConfirmAction({ action: () => handleDelete(id), label: 'delete this invoice' })
  }

  const handleEditNav = (item) => {
    if (!canEdit) { alert('No permission to edit'); return }
    setConfirmAction({ action: () => navigate(`/edit/${item.id}`), label: 'edit this invoice' })
  }

  const handleApprove = async (id, item) => {
    if (role === 'admin' && item.status === 'pending_approval') {
      if (!canAdminApprove(item)) { alert('You can only approve invoices from staff you manage.'); return }
      await updateDoc(doc(db, 'companies', companyId, 'invoices', id), { status: 'admin_approved', approvedBy: auth.currentUser.uid, approvedAt: new Date().toISOString() })
      await logAction(companyId, {
        action: 'approve', module: 'invoices',
        description: `Admin approved: ${item.invoiceNumber} — ${item.clientName}`,
        metadata: { invoiceId: id },
      })
      alert('Approved by admin ✓')
    } else if (role === 'owner' && item.status === 'admin_approved') {
      await updateDoc(doc(db, 'companies', companyId, 'invoices', id), { status: 'pending', ownerApprovedBy: auth.currentUser.uid, ownerApprovedAt: new Date().toISOString() })
      await logAction(companyId, {
        action: 'approve', module: 'invoices',
        description: `Owner final approved: ${item.invoiceNumber} — ${item.clientName}`,
        metadata: { invoiceId: id },
      })
      alert('Fully approved ✓')
    } else if (role === 'owner' && item.status === 'pending_approval') {
      await updateDoc(doc(db, 'companies', companyId, 'invoices', id), { status: 'pending', approvedBy: auth.currentUser.uid, approvedAt: new Date().toISOString(), ownerApprovedBy: auth.currentUser.uid, ownerApprovedAt: new Date().toISOString() })
      await logAction(companyId, {
        action: 'approve', module: 'invoices',
        description: `Owner approved: ${item.invoiceNumber} — ${item.clientName}`,
        metadata: { invoiceId: id },
      })
      alert('Approved ✓')
    }
  }

  const handleReject = async (id, item) => {
    if (role === 'admin' && !canAdminApprove(item)) { alert('You can only reject invoices from staff you manage.'); return }
    if (role !== 'owner' && role !== 'admin') { alert('Only admin or owner can reject'); return }
    if (!confirm('Reject this invoice?')) return
    await updateDoc(doc(db, 'companies', companyId, 'invoices', id), { status: 'rejected', rejectedBy: auth.currentUser.uid, rejectedAt: new Date().toISOString() })
    await logAction(companyId, {
      action: 'reject', module: 'invoices',
      description: `Rejected: ${item.invoiceNumber} — ${item.clientName}`,
      metadata: { invoiceId: id },
    })
  }

  const handleShareLink = (item) => {
    const url = `${window.location.origin}/verify/${companyId}/${item.securityCode || item.id}`
    navigator.clipboard.writeText(url)
    alert('Link copied!')
  }

  const handleDuplicate = async (item) => {
    if (!confirm('Duplicate this invoice?')) return
    try {
      const { id: _, ...data } = item
      await addDoc(collection(db, 'companies', companyId, 'invoices'), {
        ...data,
        invoiceNumber: (item.invoiceNumber || 'INV') + '-COPY',
        status: 'pending',
        securityCode: 'SEC-' + Math.random().toString(36).substring(2, 8).toUpperCase(),
        createdAt: serverTimestamp(),
        createdBy: auth.currentUser.uid,
      })
      await logAction(companyId, {
        action: 'create', module: 'invoices',
        description: `Duplicated invoice: ${item.invoiceNumber} — ${item.clientName}`,
        metadata: { originalId: item.id },
      })
    } catch (e) { alert(e.message) }
  }

  const openPaymentModal = (item) => {
    setPaymentModal(item)
    setPaymentBankAccountId('')
    setPaymentForm({ amount: '', date: new Date().toISOString().split('T')[0], method: paymentMethodOptions[0] || 'Cash', note: '' })
  }

  const handleSavePayment = async () => {
    if (!paymentForm.amount || Number(paymentForm.amount) <= 0) { alert('Enter valid amount'); return }
    setSavingPayment(true)
    try {
      const item = paymentModal
      const amount = Number(paymentForm.amount)
      const payments = [...(item.payments || []), {
        amount, date: paymentForm.date, method: paymentForm.method, note: paymentForm.note,
        createdAt: new Date().toISOString(),
      }]
      const totalPaid = payments.reduce((s, p) => s + p.amount, 0)
      const remaining = Number(item.totalAmount || 0) - totalPaid
      const newStatus = remaining <= 0 ? 'paid' : totalPaid > 0 ? 'partial' : 'pending'
      await updateDoc(doc(db, 'companies', companyId, 'invoices', item.id), {
        payments, paidAmount: totalPaid,
        remainingAmount: remaining < 0 ? 0 : remaining,
        status: newStatus, lastPaymentDate: paymentForm.date,
      })
      if (paymentBankAccountId) {
        const acRef = doc(db, 'companies', companyId, 'bankAccounts', paymentBankAccountId)
        const acSnap = await getDoc(acRef)
        if (acSnap.exists()) {
          const newBalance = (acSnap.data().currentBalance || 0) + amount
          await updateDoc(acRef, { currentBalance: newBalance, updatedAt: serverTimestamp() })
          await addDoc(collection(db, 'companies', companyId, 'bankAccounts', paymentBankAccountId, 'transactions'), {
            date: paymentForm.date, type: 'in', amount,
            description: `Invoice payment: ${item.invoiceNumber}`,
            reference: item.invoiceNumber,
            createdAt: serverTimestamp(),
          })
          await addDoc(collection(db, 'companies', companyId, 'journalEntries'), {
            date: paymentForm.date,
            description: `Invoice payment: ${item.invoiceNumber} — ${item.clientName}`,
            entries: [
              { account: 'Bank', accountId: paymentBankAccountId, accountName: acSnap.data().name, type: 'debit', amount },
              { account: 'Sales Revenue', accountId: 'revenue', accountName: 'Sales Revenue', type: 'credit', amount },
            ],
            ref: 'INV',
            createdAt: serverTimestamp(),
            createdBy: auth.currentUser.uid,
          })
        }
      }
      await logAction(companyId, {
        action: 'payment', module: 'invoices',
        description: `Payment recorded: ${item.invoiceNumber} — ${item.clientName} — ${amount.toLocaleString()} Ks`,
        metadata: { invoiceId: item.id, amount, method: paymentForm.method, status: newStatus },
      })
      setPaymentModal(null)
    } catch (e) { alert(e.message) }
    setSavingPayment(false)
  }

  const handleSendReminder = async (item) => {
    if (!item.clientEmail) { alert('No email address'); return }
    if (!confirm(`Send reminder to ${item.clientName}?`)) return
    setSendingReminder(item.id)
    try {
      const result = await sendInvoiceReminder({
        clientName: item.clientName, clientEmail: item.clientEmail,
        invoiceNumber: item.invoiceNumber, amount: item.remainingAmount || item.totalAmount || 0,
        status: item.status, companyName: companyInfo.name, companyEmail: companyInfo.email,
        companyPhone: companyInfo.phone, paymentMethods: companyInfo.paymentMethods,
        invoiceLink: `${window.location.origin}/verify/${companyId}/${item.securityCode || item.id}`,
      })
      if (result.success) {
        await logAction(companyId, {
          action: 'send', module: 'invoices',
          description: `Reminder sent: ${item.invoiceNumber} → ${item.clientEmail}`,
          metadata: { invoiceId: item.id, clientEmail: item.clientEmail },
        })
        alert(`Reminder sent ✓`)
      } else alert('Failed: ' + result.error)
    } catch (e) { alert(e.message) }
    setSendingReminder(null)
  }

  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>Loading...</div>

  return (
    <Layout title="Invoices">
      {confirmAction && <ConfirmPassword action={confirmAction.label} onConfirm={() => { confirmAction.action(); setConfirmAction(null) }} onCancel={() => setConfirmAction(null)} />}

      {paymentModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: 'white', borderRadius: 16, width: '100%', maxWidth: 460, boxShadow: '0 20px 60px rgba(0,0,0,0.2)', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ padding: '20px 24px', borderBottom: '0.5px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 15 }}>Record Payment</div>
                <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>
                  {paymentModal.invoiceNumber} — Total: {Number(paymentModal.totalAmount || 0).toLocaleString()} Ks
                  {paymentModal.paidAmount>0 && <span style={{ color: '#16a34a' }}> | Paid: {Number(paymentModal.paidAmount).toLocaleString()} Ks</span>}
                  {paymentModal.remainingAmount>0 && <span style={{ color: '#d97706' }}> | Due: {Number(paymentModal.remainingAmount).toLocaleString()} Ks</span>}
                </div>
              </div>
              <button type="button" onClick={() => setPaymentModal(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)' }}><X size={18} /></button>
            </div>
            <div style={{ padding: 24 }}>
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-2)', display: 'block', marginBottom: 4 }}>Amount (Ks) *</label>
                <div style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
                  <button type="button" onClick={() => setPaymentForm(f => ({ ...f, amount: String(paymentModal.remainingAmount || paymentModal.totalAmount || 0) }))} className="btn btn-ghost" style={{ fontSize: 11, padding: '4px 10px' }}>Full Amount</button>
                  {paymentModal.remainingAmount>0 && <button type="button" onClick={() => setPaymentForm(f => ({ ...f, amount: String(paymentModal.remainingAmount) }))} className="btn btn-ghost" style={{ fontSize: 11, padding: '4px 10px' }}>Remaining</button>}
                </div>
                <input className="form-input" type="number" value={paymentForm.amount} onChange={e => setPaymentForm(f => ({ ...f, amount: e.target.value }))} placeholder="Enter amount..." />
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-2)', display: 'block', marginBottom: 4 }}>Payment Date *</label>
                <input className="form-input" type="date" value={paymentForm.date} onChange={e => setPaymentForm(f => ({ ...f, date: e.target.value }))} />
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-2)', display: 'block', marginBottom: 4 }}>Payment Method</label>
                <select className="form-input" value={paymentForm.method} onChange={e => setPaymentForm(f => ({ ...f, method: e.target.value }))}>
                  {paymentMethodOptions.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-2)', display: 'block', marginBottom: 4 }}>
                  To Account <span style={{ color: 'var(--primary)', fontSize: 11 }}>(Bank balance auto တက်မည်)</span>
                </label>
                <select className="form-input" value={paymentBankAccountId} onChange={e => setPaymentBankAccountId(e.target.value)}>
                  <option value="">— Not linked —</option>
                  {bankAccounts.map(a => (
                    <option key={a.id} value={a.id}>{a.name} {a.bankName ? `(${a.bankName})` : ''} — {Number(a.currentBalance || a.openingBalance || 0).toLocaleString()} {a.currency || 'MMK'}</option>
                  ))}
                </select>
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-2)', display: 'block', marginBottom: 4 }}>Note</label>
                <input className="form-input" value={paymentForm.note} onChange={e => setPaymentForm(f => ({ ...f, note: e.target.value }))} placeholder="Optional note..." />
              </div>
              {paymentModal.payments?.length>0 && (
                <div style={{ marginBottom: 16, padding: 12, background: '#f8fafc', borderRadius: 8 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', marginBottom: 8, textTransform: 'uppercase' }}>Payment History</div>
                  {paymentModal.payments.map((p, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '4px 0', borderBottom: '0.5px solid #e2e8f0' }}>
                      <span style={{ color: 'var(--text-2)' }}>{p.date} — {p.method}</span>
                      <span style={{ fontWeight: 500, color: '#16a34a' }}>{Number(p.amount).toLocaleString()} Ks</span>
                    </div>
                  ))}
                </div>
              )}
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setPaymentModal(null)} className="btn btn-ghost">Cancel</button>
                <button type="button" onClick={handleSavePayment} disabled={savingPayment} className="btn btn-primary">
                  <CheckSquare size={14} />{savingPayment ? 'Saving...' : 'Save Payment'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {role==='admin' && pendingApproval.length>0 && (
        <div style={{ background: 'rgba(22,163,74,0.08)', border: '0.5px solid rgba(22,163,74,0.2)', borderRadius:12, padding: '12px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <AlertCircle size={16} color="#16a34a" />
            <span style={{ fontSize: 13, fontWeight: 500, color: '#16a34a' }}>{pendingApproval.length} invoice{pendingApproval.length>1?'s':''} waiting for your approval</span>
          </div>
          <button type="button" onClick={() => setFilterStatus('pending_approval')} className="btn btn-primary" style={{ fontSize: 12, padding: '5px 12px', background: '#16a34a', boxShadow: 'none' }}>Review Now</button>
        </div>
      )}
      {role==='owner' && adminApproved.length>0 && (
        <div style={{ background: 'rgba(79,110,247,0.08)', border: '0.5px solid rgba(79,110,247,0.2)', borderRadius:12, padding: '12px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <AlertCircle size={16} color="var(--primary)" />
            <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--primary)' }}>{adminApproved.length} invoice{adminApproved.length>1?'s':''} waiting for final approval</span>
          </div>
          <button type="button" onClick={() => setFilterStatus('admin_approved')} className="btn btn-primary" style={{ fontSize: 12, padding: '5px 12px' }}>Review Now</button>
        </div>
      )}

      <div className="stats-grid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
        {statsCards.map(({ label, value, amount, color, bg }) => (
          <div key={label} className="card" style={{ padding: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-2)', marginBottom: 8 }}>{label}</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-1)', marginBottom: 2 }}>{value}</div>
            <div style={{ fontSize: 12, color, fontWeight: 500 }}>{amount.toLocaleString()} Ks</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 16, justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', flex: 1 }}>
          <div style={{ position: 'relative' }}>
            <Search size={12} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)' }} />
            <input className="form-input" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search..." style={{ paddingLeft: 26, fontSize: 12, padding: '6px 8px 6px 26px', width: 140 }} />
          </div>
          <select className="form-input" style={{ width: 'auto', fontSize: 12, padding: '6px 8px' }} value={filterYear} onChange={e => { setFilterYear(e.target.value); setFilterMonth('') }}>
            <option value="">All Years</option>
            {uniqueYears.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <select className="form-input" style={{ width: 'auto', fontSize: 12, padding: '6px 8px' }} value={filterMonth} onChange={e => setFilterMonth(e.target.value)}>
            <option value="">All Months</option>
            {months.map((m, i) => <option key={m} value={m}>{monthNames[i]}</option>)}
          </select>
          <select className="form-input" style={{ width: 'auto', fontSize: 12, padding: '6px 8px' }} value={filterCustomer} onChange={e => setFilterCustomer(e.target.value)}>
            <option value="">All Customers</option>
            {uniqueCustomers.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select className="form-input" style={{ width: 'auto', fontSize: 12, padding: '6px 8px' }} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
            <option value="">All Status</option>
            {['paid', 'pending', 'partial', 'overdue', 'refunded', 'pending_approval', 'admin_approved', 'rejected'].map(s => (
              <option key={s} value={s}>{s === 'pending_approval' ? 'Needs Approval' : s === 'admin_approved' ? 'Admin Approved' : s}</option>
            ))}
          </select>
          {(filterYear || filterMonth || filterCustomer || filterStatus || search) && (
            <button type="button" onClick={() => { setFilterYear(''); setFilterMonth(''); setFilterCustomer(''); setFilterStatus(''); setSearch('') }} className="btn btn-ghost" style={{ fontSize: 11, padding: '5px 10px', color: '#dc2626' }}>
              <X size={12} />Clear
            </button>
          )}
        </div>
        <button type="button" className="btn btn-primary" onClick={() => navigate('/create-invoice')}>
          <Plus size={15} />New Invoice
        </button>
      </div>

      {someSelected && (
        <div style={{ background: 'linear-gradient(135deg,#1a1d2e,#2d3260)', borderRadius: 12, padding: '12px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'white' }}>{selectedIds.size} invoice{selectedIds.size>1?'s':''} selected</span>
            <button type="button" onClick={clearSelection} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', cursor: 'pointer', color: 'white', padding: '2px 8px', borderRadius: 6, fontSize: 11 }}>Clear</button>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" onClick={handleBulkMarkPaid} disabled={bulkLoading} className="btn" style={{ background: 'rgba(22,163,74,0.2)', color: '#4ade80', border: '0.5px solid rgba(22,163,74,0.3)', fontSize: 12, padding: '6px 12px' }}>
              <CheckCircle size={13} />Mark Paid
            </button>
            <button type="button" onClick={handleBulkReminder} disabled={bulkLoading} className="btn" style={{ background: 'rgba(79,110,247,0.2)', color: '#818cf8', border: '0.5px solid rgba(79,110,247,0.3)', fontSize: 12, padding: '6px 12px' }}>
              <Mail size={13} />Send Reminder
            </button>
            <button type="button" onClick={handleBulkExportCSV} disabled={bulkLoading} className="btn" style={{ background: 'rgba(217,119,6,0.2)', color: '#fbbf24', border: '0.5px solid rgba(217,119,6,0.3)', fontSize: 12, padding: '6px 12px' }}>
              <Download size={13} />Export CSV
            </button>
            {canDelete && (
              <button type="button" onClick={handleBulkDelete} disabled={bulkLoading} className="btn" style={{ background: 'rgba(220,38,38,0.2)', color: '#f87171', border: '0.5px solid rgba(220,38,38,0.3)', fontSize: 12, padding: '6px 12px' }}>
                <Trash2 size={13} />Delete
              </button>
            )}
          </div>
          {bulkLoading && <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>Processing...</span>}
        </div>
      )}

      <div className="card" style={{overflow:'hidden'}}>{filteredInvoices.length===0?(<div style={{padding:64,textAlign:'center',color:'var(--text-3)'}}><FileText size={40} style={{margin:'0 auto 12px',opacity:0.3}}/><div>No invoices found</div></div>):(<>{/* Desktop Table */}<div className="desktop-table" style={{overflowX:'auto'}}><table style={{width:'100%'}}><thead><tr><th style={{width:40,textAlign:'center',padding:'10px 8px'}}><button type="button" onClick={toggleSelectAll} style={{background:'none',border:'none',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto'}}><div style={{width:16,height:16,borderRadius:4,border:`2px solid ${allSelected?'var(--primary)':'#d1d5db'}`,background:allSelected?'var(--primary)':'white',display:'flex',alignItems:'center',justifyContent:'center',transition:'all 0.15s'}}>{allSelected&&<span style={{color:'white',fontSize:10,fontWeight:700,lineHeight:1}}>✓</span>}</div></button></th><th>Number</th><th>Client</th><th style={{textAlign:'right'}}>Amount</th><th style={{textAlign:'right'}}>Paid</th><th style={{textAlign:'center'}}>Status</th><th>Date</th><th style={{textAlign:'center'}}>Actions</th></tr></thead><tbody>{filteredInvoices.map(item=>{const isSelected=selectedIds.has(item.id); return(<tr key={item.id} style={{background:isSelected?'rgba(79,110,247,0.06)':item.status==='pending_approval'?'rgba(79,110,247,0.03)':item.status==='admin_approved'?'rgba(22,163,74,0.03)':''}}><td style={{textAlign:'center',padding:'10px 8px'}}><button type="button" onClick={()=>toggleSelect(item.id)} style={{background:'none',border:'none',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto'}}><div style={{width:16,height:16,borderRadius:4,border:`2px solid ${isSelected?'var(--primary)':'#d1d5db'}`,background:isSelected?'var(--primary)':'white',display:'flex',alignItems:'center',justifyContent:'center',transition:'all 0.15s'}}>{isSelected&&<span style={{color:'white',fontSize:10,fontWeight:700,lineHeight:1}}>✓</span>}</div></button></td><td style={{color:'var(--primary)',fontFamily:'monospace',fontWeight:500,fontSize:12}}>{item.invoiceNumber}</td><td style={{fontWeight:500}}>{item.clientName}</td><td style={{textAlign:'right',fontWeight:500}}>{Number(item.totalAmount||0).toLocaleString()} Ks</td><td style={{textAlign:'right',fontSize:12}}>{item.paidAmount>0?<span style={{color:'#16a34a',fontWeight:500}}>{Number(item.paidAmount).toLocaleString()} Ks</span>:<span style={{color:'var(--text-3)'}}>-</span>}</td><td style={{textAlign:'center'}}>{statusBadge(item.status)}</td><td style={{color:'var(--text-3)',fontSize:12}}><div>{item.createdAt?.seconds?new Date(item.createdAt.seconds*1000).toLocaleDateString():'-'}</div>{item.lastPaymentDate&&<div style={{color:'#16a34a',fontSize:11}}>Paid: {item.lastPaymentDate}</div>}</td><td style={{textAlign:'center'}}><div style={{display:'flex',gap:4,justifyContent:'center',alignItems:'center'}}><button type="button" onClick={()=>navigate(`/invoice/${item.id}`)} title="View" style={{background:'none',border:'none',cursor:'pointer',color:'var(--primary)',padding:4,borderRadius:6}}><Printer size={14}/></button><button type="button" onClick={()=>handleEditNav(item)} title="Edit" style={{background:'none',border:'none',cursor:canEdit?'pointer':'not-allowed',color:canEdit?'var(--text-2)':'var(--text-3)',padding:4,borderRadius:6,opacity:canEdit?1:0.4}}><Edit size={14}/></button><button type="button" onClick={()=>handleDuplicate(item)} title="Duplicate" style={{background:'none',border:'none',cursor:'pointer',color:'#8b5cf6',padding:4,borderRadius:6}}><CopyPlus size={14}/></button><button type="button" onClick={()=>handleShareLink(item)} title="Share link" style={{background:'none',border:'none',cursor:'pointer',color:'var(--text-2)',padding:4,borderRadius:6}}><Link size={14}/></button>{item.status==='pending_approval'&&canAdminApprove(item)&&(role==='admin'||role==='owner')&&<><button type="button" onClick={()=>handleApprove(item.id,item)} style={{background:'none',border:'none',cursor:'pointer',color:'#16a34a',padding:4,borderRadius:6}}><ThumbsUp size={14}/></button><button type="button" onClick={()=>handleReject(item.id,item)} style={{background:'none',border:'none',cursor:'pointer',color:'#dc2626',padding:4,borderRadius:6}}><ThumbsDown size={14}/></button></>}{item.status==='admin_approved'&&role==='owner'&&<><button type="button" onClick={()=>handleApprove(item.id,item)} style={{background:'none',border:'none',cursor:'pointer',color:'#4F6EF7',padding:4,borderRadius:6}}><ThumbsUp size={14}/></button><button type="button" onClick={()=>handleReject(item.id,item)} style={{background:'none',border:'none',cursor:'pointer',color:'#dc2626',padding:4,borderRadius:6}}><ThumbsDown size={14}/></button></>}{['pending','partial','overdue'].includes(item.status)&&<><button type="button" onClick={()=>openPaymentModal(item)} style={{background:'none',border:'none',cursor:'pointer',color:'#16a34a',padding:4,borderRadius:6}}><DollarSign size={14}/></button><button type="button" onClick={()=>handleSendReminder(item)} disabled={sendingReminder===item.id} style={{background:'none',border:'none',cursor:'pointer',color:'#d97706',padding:4,borderRadius:6,opacity:sendingReminder===item.id?0.5:1}}><Mail size={14}/></button></>}{canDelete&&<button type="button" onClick={()=>handleDeleteWithAuth(item.id)} style={{background:'none',border:'none',cursor:'pointer',color:'var(--danger)',padding:4,borderRadius:6}}><Trash2 size={14}/></button>}</div></td></tr>)})}</tbody></table></div>{/* Mobile Cards */}<div className="mobile-cards">{filteredInvoices.map(item=>{const isSelected=selectedIds.has(item.id); return(<div key={item.id} style={{padding:16,borderBottom:'0.5px solid #f1f5f9',background:isSelected?'rgba(79,110,247,0.06)':'white',}}>{/* Row 1 — checkbox + invoice# + client + status */}<div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:10}}><div style={{display:'flex',alignItems:'center',gap:10}}><button type="button" onClick={()=>toggleSelect(item.id)} style={{background:'none',border:'none',cursor:'pointer',padding:0,flexShrink:0}}><div style={{width:18,height:18,borderRadius:4,border:`2px solid ${isSelected?'var(--primary)':'#d1d5db'}`,background:isSelected?'var(--primary)':'white',display:'flex',alignItems:'center',justifyContent:'center'}}>{isSelected&&<span style={{color:'white',fontSize:11,fontWeight:700}}>✓</span>}</div></button><div><div style={{fontSize:12,fontFamily:'monospace',color:'var(--primary)',fontWeight:600}}>{item.invoiceNumber}</div><div style={{fontSize:14,fontWeight:600,color:'var(--text-1)',marginTop:1}}>{item.clientName}</div></div></div>{statusBadge(item.status)}</div>{/* Row 2 — amount + paid + date */}<div style={{display:'flex',justifyContent:'space-between',marginBottom:10,padding:'8px 0',borderTop:'0.5px solid #f8fafc',borderBottom:'0.5px solid #f8fafc'}}><div><div style={{fontSize:10,color:'var(--text-3)',marginBottom:2}}>Total</div><div style={{fontSize:14,fontWeight:700,color:'var(--text-1)'}}>{Number(item.totalAmount||0).toLocaleString()} Ks</div></div>{item.paidAmount>0&&(<div style={{textAlign:'center'}}><div style={{fontSize:10,color:'var(--text-3)',marginBottom:2}}>Paid</div><div style={{fontSize:13,fontWeight:600,color:'#16a34a'}}>{Number(item.paidAmount).toLocaleString()} Ks</div></div>)}<div style={{textAlign:'right'}}><div style={{fontSize:10,color:'var(--text-3)',marginBottom:2}}>Date</div><div style={{fontSize:12,color:'var(--text-2)'}}>{item.createdAt?.seconds?new Date(item.createdAt.seconds*1000).toLocaleDateString('en-GB'):'-'}</div>{item.lastPaymentDate&&<div style={{fontSize:10,color:'#16a34a'}}>Paid: {item.lastPaymentDate}</div>}</div></div>{/* Row 3 — action buttons */}<div style={{display:'flex',gap:6,flexWrap:'wrap'}}><button type="button" onClick={()=>navigate(`/invoice/${item.id}`)} className="btn btn-ghost" style={{fontSize:11,padding:'5px 10px',flex:1}}><Printer size={12}/>View</button>{['pending','partial','overdue'].includes(item.status)&&(<button type="button" onClick={()=>openPaymentModal(item)} className="btn btn-ghost" style={{fontSize:11,padding:'5px 10px',flex:1,color:'#16a34a',borderColor:'rgba(22,163,74,0.3)'}}><DollarSign size={12}/>Pay</button>)}{['pending','partial','overdue'].includes(item.status)&&(<button type="button" onClick={()=>handleSendReminder(item)} disabled={sendingReminder===item.id} className="btn btn-ghost" style={{fontSize:11,padding:'5px 10px',flex:1,color:'#4F6EF7'}}><Mail size={12}/>{sendingReminder===item.id?'...':'Remind'}</button>)}{item.status==='pending_approval'&&canAdminApprove(item)&&(role==='admin'||role==='owner')&&(<><button type="button" onClick={()=>handleApprove(item.id,item)} className="btn btn-ghost" style={{fontSize:11,padding:'5px 10px',color:'#16a34a'}}><ThumbsUp size={12}/>Approve</button><button type="button" onClick={()=>handleReject(item.id,item)} className="btn btn-ghost" style={{fontSize:11,padding:'5px 10px',color:'#dc2626'}}><ThumbsDown size={12}/>Reject</button></>)}{item.status==='admin_approved'&&role==='owner'&&(<button type="button" onClick={()=>handleApprove(item.id,item)} className="btn btn-ghost" style={{fontSize:11,padding:'5px 10px',color:'#4F6EF7'}}><ThumbsUp size={12}/>Final Approve</button>)}<button type="button" onClick={()=>handleEditNav(item)} className="btn btn-ghost" style={{fontSize:11,padding:'5px 10px'}}><Edit size={12}/>Edit</button>{canDelete&&(<button type="button" onClick={()=>handleDeleteWithAuth(item.id)} className="btn btn-ghost" style={{fontSize:11,padding:'5px 10px',color:'#dc2626'}}><Trash2 size={12}/>Delete</button>)}</div></div>)})}</div></>)}</div>
    </Layout>
  )
}
