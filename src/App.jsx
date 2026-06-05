import{BrowserRouter,Routes,Route,Navigate}from'react-router-dom'
import{useEffect,useState}from'react'
import{auth}from'./firebase'
import{onAuthStateChanged}from'firebase/auth'
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
<Route path="/" element={user?<Dashboard/>:<Navigate to="/login"/>}/>
<Route path="/invoice/:id" element={user?<InvoiceDetail/>:<Navigate to="/login"/>}/>
<Route path="/create-invoice" element={user?<CreateInvoice/>:<Navigate to="/login"/>}/>
<Route path="/edit/:id" element={user?<EditInvoice/>:<Navigate to="/login"/>}/>
<Route path="/create-quotation" element={user?<CreateQuotation/>:<Navigate to="/login"/>}/>
<Route path="/customers" element={user?<Customers/>:<Navigate to="/login"/>}/>
<Route path="/expenses" element={user?<Expenses/>:<Navigate to="/login"/>}/>
<Route path="/reports" element={user?<Reports/>:<Navigate to="/login"/>}/>
<Route path="/contracts" element={user?<Contracts/>:<Navigate to="/login"/>}/>
<Route path="/profile" element={user?<Profile/>:<Navigate to="/login"/>}/>
<Route path="/settings" element={user?<Settings/>:<Navigate to="/login"/>}/>
<Route path="/projects" element={user?<Projects/>:<Navigate to="/login"/>}/>
<Route path="/signup" element={!user?<Signup/>:<Navigate to="/"/>}/>
<Route path="/join" element={!user?<JoinCompany/>:<Navigate to="/"/>}/>
<Route path="/quotation/:id" element={user?<QuotationDetail/>:<Navigate to="/login"/>}/>
<Route path="/edit-quotation/:id" element={user?<EditQuotation/>:<Navigate to="/login"/>}/>
<Route path="/chart-of-accounts" element={user?<ChartOfAccounts/>:<Navigate to="/login"/>}/>
<Route path="*" element={<Navigate to="/"/>}/>
<Route path="/bank-accounts" element={user?<BankAccounts/>:<Navigate to="/login"/>}/>
<Route path="/invoices" element={user?<Invoices/>:<Navigate to="/login"/>}/>
<Route path="/quotations" element={user?<Quotations/>:<Navigate to="/login"/>}/>
</Routes>
</BrowserRouter>
)
}
