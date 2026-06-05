import{useState,useEffect}from'react'
import{auth,db}from'../firebase'
import{signOut}from'firebase/auth'
import{useLocation,useNavigate,useSearchParams}from'react-router-dom'
import{FileText,FileCheck,ScrollText,Users,Wallet,Briefcase,BarChart2,User,Settings,LogOut,Menu,X,BookOpen,Landmark,LayoutDashboard}from'lucide-react'
import{getDocs,collection,query,where}from'firebase/firestore'
import Notifications from'./Notifications'
import{useNotifications}from'../hooks/useNotifications'
import{useRecurring}from'../hooks/useRecurring'
import{useRole}from'../hooks/useRole'

const NAV_MAIN=[
{path:'/',label:'Dashboard',icon:LayoutDashboard},
{path:'/invoices',label:'Invoices',icon:FileText},
{path:'/',tab:'quotation',label:'Quotations',icon:FileCheck},
{path:'/contracts',label:'Contracts',icon:ScrollText},
{path:'/customers',label:'Customers',icon:Users},
{path:'/expenses',label:'Expenses',icon:Wallet},
{path:'/projects',label:'Projects',icon:Briefcase},
{path:'/quotations',label:'Quotations',icon:FileCheck},
]

const AnkoraLogo=()=>(
<svg width="34" height="34" viewBox="0 0 34 34" fill="none" xmlns="http://www.w3.org/2000/svg">
<rect width="34" height="34" rx="10" fill="url(#ankoraGrad)"/>
<defs>
<linearGradient id="ankoraGrad" x1="0" y1="0" x2="34" y2="34" gradientUnits="userSpaceOnUse">
<stop offset="0%" stopColor="#4F6EF7"/>
<stop offset="100%" stopColor="#7C3AED"/>
</linearGradient>
</defs>
<text x="5" y="24" fontSize="18" fontWeight="800" fill="white" fontFamily="Georgia,serif">X</text>
</svg>
)

export default function Layout({children,title}){
const[open,setOpen]=useState(false)
const[companyId,setCompanyId]=useState(null)
const location=useLocation()
const navigate=useNavigate()
const[searchParams]=useSearchParams()
const{canSettings,canReports}=useRole()

useEffect(()=>{
const load=async()=>{
try{
const snap=await getDocs(query(collection(db,'companies'),where(`members.${auth.currentUser?.uid}`,'!=',null)))
if(!snap.empty)setCompanyId(snap.docs[0].id)
}catch(e){}
}
load()
},[])

useNotifications(companyId)
useRecurring(companyId)

const isActive=(item)=>{
if(item.path==='/'&&!item.tab){
return location.pathname==='/'&&!searchParams.get('tab')
}
if(item.tab){
const currentTab=searchParams.get('tab')||''
return location.pathname==='/'&&currentTab===item.tab
}
return location.pathname===item.path
}

const handleNav=(item)=>{
if(item.tab)navigate(`/?tab=${item.tab}`)
else navigate(item.path)
setOpen(false)
}

return(
<div style={{display:'flex',minHeight:'100vh'}}>
{open&&<div onClick={()=>setOpen(false)} style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.3)',zIndex:98}}/>}
<aside className={`sidebar${open?' open':''}`}>
<div style={{padding:'20px 18px 16px',borderBottom:'0.5px solid var(--border)'}}>
<div style={{display:'flex',alignItems:'center',gap:10}}>
<AnkoraLogo/>
<div>
<div style={{fontWeight:700,fontSize:15,color:'var(--text-1)',letterSpacing:'0.02em'}}>Ankora<span style={{color:'var(--primary)'}}>X</span></div>
<div style={{fontSize:10,color:'var(--text-3)',marginTop:1}}>{auth.currentUser?.email}</div>
</div>
</div>
</div>
<nav style={{flex:1,padding:'12px 10px',overflowY:'auto'}}>
<div style={{fontSize:10,fontWeight:600,color:'var(--text-3)',textTransform:'uppercase',letterSpacing:'0.07em',padding:'8px 8px 4px'}}>Main</div>
{NAV_MAIN.map((item)=>(
<div key={item.tab||item.path+item.label} className={`nav-item${isActive(item)?' active':''}`} onClick={()=>handleNav(item)}>
<item.icon size={17}/><span>{item.label}</span>
</div>
))}
{canReports&&(
<>
<div style={{fontSize:10,fontWeight:600,color:'var(--text-3)',textTransform:'uppercase',letterSpacing:'0.07em',padding:'12px 8px 4px',marginTop:8}}>Finance</div>
<div className={`nav-item${location.pathname==='/chart-of-accounts'?' active':''}`} onClick={()=>{navigate('/chart-of-accounts');setOpen(false)}}>
<BookOpen size={17}/><span>Chart of Accounts</span>
</div>
<div className={`nav-item${location.pathname==='/bank-accounts'?' active':''}`} onClick={()=>{navigate('/bank-accounts');setOpen(false)}}>
<Landmark size={17}/><span>Bank Accounts</span>
</div>
<div className={`nav-item${location.pathname==='/reports'?' active':''}`} onClick={()=>{navigate('/reports');setOpen(false)}}>
<BarChart2 size={17}/><span>Reports</span>
</div>
</>
)}
<div style={{fontSize:10,fontWeight:600,color:'var(--text-3)',textTransform:'uppercase',letterSpacing:'0.07em',padding:'12px 8px 4px',marginTop:8}}>Account</div>
<div className={`nav-item${location.pathname==='/profile'?' active':''}`} onClick={()=>{navigate('/profile');setOpen(false)}}>
<User size={17}/><span>Profile</span>
</div>
{canSettings&&(
<div className={`nav-item${location.pathname==='/settings'?' active':''}`} onClick={()=>{navigate('/settings');setOpen(false)}}>
<Settings size={17}/><span>Settings</span>
</div>
)}
</nav>
<div style={{padding:10,borderTop:'0.5px solid var(--border)'}}>
<div style={{padding:'6px 8px',marginBottom:6,fontSize:11,color:'var(--text-3)',textAlign:'center'}}>
Powered by <span style={{fontWeight:700,color:'var(--primary)'}}>AnkoraX</span>
</div>
<div className="nav-item" style={{color:'#ef4444'}} onClick={()=>signOut(auth)}>
<LogOut size={17}/><span>Logout</span>
</div>
</div>
</aside>
<div className="main-area">
<div className="topbar">
<button id="hamburger" onClick={()=>setOpen(v=>!v)} className="btn btn-ghost" style={{padding:'6px 8px'}}>
{open?<X size={18}/>:<Menu size={18}/>}
</button>
<div style={{flex:1,fontWeight:500,fontSize:15,color:'var(--text-1)'}}>{title}</div>
<Notifications companyId={companyId}/>
<span style={{fontSize:11,background:'var(--primary-light)',color:'var(--primary)',padding:'3px 10px',borderRadius:20,fontWeight:600}}>Free</span>
</div>
<div className="page-content">{children}</div>
</div>
</div>
)
}
