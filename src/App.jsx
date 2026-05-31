import{BrowserRouter,Routes,Route,Navigate}from'react-router-dom'
import{useEffect,useState}from'react'
import{auth}from'./firebase'
import{onAuthStateChanged}from'firebase/auth'
import Login from'./pages/Login'
import Dashboard from'./pages/Dashboard'
import Verify from'./pages/Verify'
import InvoiceDetail from'./pages/InvoiceDetail'
import Settings from'./pages/Settings'

export default function App(){
const[user,setUser]=useState(null)
const[loading,setLoading]=useState(true)
useEffect(()=>{return onAuthStateChanged(auth,u=>{setUser(u);setLoading(false)})},[])
if(loading)return<div style={{display:'flex',alignItems:'center',justifyContent:'center',minHeight:'100vh',color:'#9aa0b4'}}>Loading...</div>
return(
<BrowserRouter>
<Routes>
<Route path="/login" element={!user?<Login/>:<Navigate to="/"/>}/>
<Route path="/verify/:companyId/:code" element={<Verify/>}/>
<Route path="/" element={user?<Dashboard/>:<Navigate to="/login"/>}/>
<Route path="/invoice/:id" element={user?<InvoiceDetail/>:<Navigate to="/login"/>}/>
<Route path="/settings" element={user?<Settings/>:<Navigate to="/login"/>}/>
<Route path="/*" element={<Navigate to="/"/>}/>
</Routes>
</BrowserRouter>
)
}
