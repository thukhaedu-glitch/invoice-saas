import{BrowserRouter,Routes,Route,Navigate}from'react-router-dom'
import{useEffect,useState}from'react'
import{auth,db}from'./firebase'
import{onAuthStateChanged,signOut}from'firebase/auth'
import{collection,getDocs,query,where}from'firebase/firestore'
import Login from'./pages/Login'
import Dashboard from'./pages/Dashboard'
import Verify from'./pages/Verify'
import VerifySearch from'./pages/VerifySearch'
import InvoiceDetail from'./pages/InvoiceDetail'
import Settings from'./pages/Settings'
import CreateInvoice from'./pages/CreateInvoice'
import EditInvoice from'./pages/EditInvoice'
import Customers from'./pages/Customers'
import Expenses from'./pages/Expenses'
import Reports from'./pages/Reports'
import Contracts from'./pages/Contracts'
import CreateQuotation from'./pages/CreateQuotation'
import Profile from'./pages/Profile'
import Projects from'./pages/Projects'
import Signup from'./pages/Signup'
import JoinCompany from'./pages/JoinCompany'
import QuotationDetail from'./pages/QuotationDetail'
import EditQuotation from'./pages/EditQuotation'
import ChartOfAccounts from'./pages/ChartOfAccounts'
import BankAccounts from'./pages/BankAccounts'
import Invoices from'./pages/Invoices'
import Quotations from'./pages/Quotations'
import CustomerDetail from'./pages/CustomerDetail'
import Bills from'./pages/Bills'
import Reconcile from'./pages/Reconcile'
import JournalEntries from'./pages/JournalEntries'
import CustomDashboard from'./pages/CustomDashboard'
import ReportBuilder from'./pages/ReportBuilder'
import AuditLog from'./pages/AuditLog'
import Upgrade from'./pages/Upgrade'

function BlockedScreen(){
return(
<div style={{display:'flex',alignItems:'center',justifyContent:'center',minHeight:'100vh',background:'#f8fafc'}}>
<div style={{background:'white',borderRadius:20,padding:'48px 40px',textAlign:'center',maxWidth:400,boxShadow:'0 8px 32px rgba(0,0,0,0.08)',border:'0.5px solid #e2e8f0'}}>
<div style={{width:64,height:64,borderRadius:'50%',background:'rgba(220,38,38,0.1)',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 20px'}}>
<span style={{fontSize:28}}>🔒</span>
</div>
<div style={{fontSize:20,fontWeight:700,color:'#dc2626',marginBottom:8}}>Account Suspended</div>
<div style={{fontSize:14,color:'#94a3b8',marginBottom:20,lineHeight:1.6}}>
Your account has been suspended. Please contact support to resolve this issue.
</div>
<div style={{fontSize:13,color:'#94a3b8',background:'#f8fafc',padding:'10px 16px',borderRadius:10,marginBottom:16}}>
support@ankorax.com
</div>
<button type="button" onClick={()=>signOut(auth)} style={{background:'none',border:'0.5px solid #e2e8f0',borderRadius:8,padding:'8px 20px',cursor:'pointer',fontSize:13,color:'#64748b'}}>
Sign Out
</button>
</div>
</div>
)
}

function PrivateRoute({children}){
const[status,setStatus]=useState('checking')

useEffect(()=>{
const unsub=onAuthStateChanged(auth,async u=>{
if(!u){setStatus('unauthenticated');return}
try{
const snap=await getDocs(query(collection(db,'companies'),where(`members.${u.uid}`,'!=',null)))
if(!snap.empty){
const data=snap.docs[0].data()
const subStatus=data.subscriptionStatus||'active'
if(subStatus==='blocked'||subStatus==='hold'){
setStatus('blocked')
return
}
}
}catch(e){}
setStatus('ok')
})
return unsub
},[])

if(status==='checking')return<div style={{display:'flex',alignItems:'center',justifyContent:'center',minHeight:'100vh',color:'#9aa0b4'}}>Loading...</div>
if(status==='unauthenticated')return<Navigate to="/login"/>
if(status==='blocked')return<BlockedScreen/>
return children
}

export default function App(){
const[user,setUser]=useState(null)
const[loading,setLoading]=useState(true)
useEffect(()=>{return onAuthStateChanged(auth,u=>{setUser(u);setLoading(false)})},[])
if(loading)return<div style={{display:'flex',alignItems:'center',justifyContent:'center',minHeight:'100vh',color:'#9aa0b4'}}>Loading...</div>

return(
<BrowserRouter>
<Routes>
<Route path="/login" element={!user?<Login/>:<Navigate to="/"/>}/>
<Route path="/verify" element={<VerifySearch/>}/>
<Route path="/verify/:companyId/:code" element={<Verify/>}/>
<Route path="/signup" element={!user?<Signup/>:<Navigate to="/"/>}/>
<Route path="/join" element={!user?<JoinCompany/>:<Navigate to="/"/>}/>

<Route path="/" element={<PrivateRoute><Dashboard/></PrivateRoute>}/>
<Route path="/invoice/:id" element={<PrivateRoute><InvoiceDetail/></PrivateRoute>}/>
<Route path="/create-invoice" element={<PrivateRoute><CreateInvoice/></PrivateRoute>}/>
<Route path="/edit/:id" element={<PrivateRoute><EditInvoice/></PrivateRoute>}/>
<Route path="/create-quotation" element={<PrivateRoute><CreateQuotation/></PrivateRoute>}/>
<Route path="/customers" element={<PrivateRoute><Customers/></PrivateRoute>}/>
<Route path="/expenses" element={<PrivateRoute><Expenses/></PrivateRoute>}/>
<Route path="/reports" element={<PrivateRoute><Reports/></PrivateRoute>}/>
<Route path="/contracts" element={<PrivateRoute><Contracts/></PrivateRoute>}/>
<Route path="/profile" element={<PrivateRoute><Profile/></PrivateRoute>}/>
<Route path="/settings" element={<PrivateRoute><Settings/></PrivateRoute>}/>
<Route path="/projects" element={<PrivateRoute><Projects/></PrivateRoute>}/>
<Route path="/quotation/:id" element={<PrivateRoute><QuotationDetail/></PrivateRoute>}/>
<Route path="/edit-quotation/:id" element={<PrivateRoute><EditQuotation/></PrivateRoute>}/>
<Route path="/chart-of-accounts" element={<PrivateRoute><ChartOfAccounts/></PrivateRoute>}/>
<Route path="/bank-accounts" element={<PrivateRoute><BankAccounts/></PrivateRoute>}/>
<Route path="/invoices" element={<PrivateRoute><Invoices/></PrivateRoute>}/>
<Route path="/quotations" element={<PrivateRoute><Quotations/></PrivateRoute>}/>
<Route path="/customer/:id" element={<PrivateRoute><CustomerDetail/></PrivateRoute>}/>
<Route path="/bills" element={<PrivateRoute><Bills/></PrivateRoute>}/>
<Route path="/reconcile/:accountId" element={<PrivateRoute><Reconcile/></PrivateRoute>}/>
<Route path="/journal-entries" element={<PrivateRoute><JournalEntries/></PrivateRoute>}/>
<Route path="/custom-dashboard" element={<PrivateRoute><CustomDashboard/></PrivateRoute>}/>
<Route path="/report-builder" element={<PrivateRoute><ReportBuilder/></PrivateRoute>}/>
<Route path="/audit-log" element={<PrivateRoute><AuditLog/></PrivateRoute>}/>
<Route path="/upgrade" element={<PrivateRoute><Upgrade/></PrivateRoute>}/>
<Route path="*" element={<Navigate to="/"/>}/>
</Routes>
</BrowserRouter>
)
}
